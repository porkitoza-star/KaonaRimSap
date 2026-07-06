import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApprovalDecision,
  BillStatus,
  InvoiceStatus,
  PaymentDirection,
  PaymentStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JournalService } from '../journal/journal.service';
import { ProposePaymentDto } from './dto/propose-payment.dto';
import { RecordReceiptDto } from './dto/record-receipt.dto';
import { STANDARD_ACCOUNT_CODES } from '../common/constants';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class PaymentsService {
  private readonly ceoThreshold: number;

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private journal: JournalService,
    private config: ConfigService,
  ) {
    this.ceoThreshold = Number(this.config.get<string>('CEO_APPROVAL_THRESHOLD_THB', '50000'));
  }

  findAll() {
    return this.prisma.payment.findMany({
      include: { allocations: true, approvals: true, proposedBy: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        allocations: { include: { bill: true, invoice: true } },
        approvals: { include: { approver: true } },
        proposedBy: true,
      },
    });
    if (!payment) {
      throw new NotFoundException('ไม่พบรายการชำระเงินนี้');
    }
    return payment;
  }

  private async getBillRemainingBalance(billId: string, tx: Prisma.TransactionClient) {
    const bill = await tx.bill.findUniqueOrThrow({ where: { id: billId } });
    const paidAgg = await tx.paymentAllocation.aggregate({
      where: { billId, payment: { status: PaymentStatus.COMPLETED } },
      _sum: { amount: true },
    });
    return round2(Number(bill.totalAmount) - Number(paidAgg._sum.amount ?? 0));
  }

  private async getInvoiceRemainingBalance(invoiceId: string, tx: Prisma.TransactionClient) {
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const paidAgg = await tx.paymentAllocation.aggregate({
      where: { invoiceId, payment: { status: PaymentStatus.COMPLETED } },
      _sum: { amount: true },
    });
    return round2(Number(invoice.totalAmount) - Number(paidAgg._sum.amount ?? 0));
  }

  private async updateInvoiceStatusAfterPayment(invoiceId: string, tx: Prisma.TransactionClient) {
    const remaining = await this.getInvoiceRemainingBalance(invoiceId, tx);
    const status = remaining <= 0.01 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
    await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
  }

  private async updateBillStatusAfterPayment(billId: string, tx: Prisma.TransactionClient) {
    const remaining = await this.getBillRemainingBalance(billId, tx);
    const status = remaining <= 0.01 ? BillStatus.PAID : BillStatus.PARTIALLY_PAID;
    await tx.bill.update({ where: { id: billId }, data: { status } });
  }

  async proposePayment(dto: ProposePaymentDto, userId: string) {
    const totalAllocated = round2(dto.allocations.reduce((sum, a) => sum + a.amount, 0));
    if (totalAllocated !== round2(dto.amount)) {
      throw new BadRequestException('ยอดรวมการจัดสรรต้องเท่ากับยอดจ่ายเงิน');
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      for (const alloc of dto.allocations) {
        const bill = await tx.bill.findUnique({ where: { id: alloc.billId } });
        if (!bill) {
          throw new NotFoundException(`ไม่พบบิล ${alloc.billId}`);
        }
        if (bill.status !== BillStatus.CONFIRMED && bill.status !== BillStatus.PARTIALLY_PAID) {
          throw new BadRequestException(`บิลเลขที่ ${bill.number} ไม่อยู่ในสถานะที่จ่ายเงินได้`);
        }
        const remaining = await this.getBillRemainingBalance(alloc.billId, tx);
        if (alloc.amount > remaining + 0.01) {
          throw new BadRequestException(
            `ยอดจ่ายเกินยอดคงเหลือของบิลเลขที่ ${bill.number} (คงเหลือ ${remaining})`,
          );
        }
      }

      const needsCeoApproval = dto.amount > this.ceoThreshold;

      return tx.payment.create({
        data: {
          direction: PaymentDirection.PAY,
          amount: dto.amount,
          method: dto.method,
          status: PaymentStatus.PENDING_CFO_APPROVAL,
          proposedById: userId,
          allocations: {
            create: dto.allocations.map((a) => ({ billId: a.billId, amount: a.amount })),
          },
          approvals: {
            create: [{ level: 1 }, ...(needsCeoApproval ? [{ level: 2 }] : [])],
          },
        },
        include: { allocations: true, approvals: true },
      });
    });

    await this.audit.log({
      userId,
      action: 'PROPOSE',
      entityType: 'Payment',
      entityId: payment.id,
      after: payment,
    });
    return payment;
  }

  async recordReceipt(dto: RecordReceiptDto, userId: string) {
    const totalAllocated = round2(dto.allocations.reduce((sum, a) => sum + a.amount, 0));
    if (totalAllocated !== round2(dto.amount)) {
      throw new BadRequestException('ยอดรวมการจัดสรรต้องเท่ากับยอดรับเงิน');
    }

    const bankAccount = await this.prisma.account.findUniqueOrThrow({
      where: { code: STANDARD_ACCOUNT_CODES.BANK },
    });
    const arAccount = await this.prisma.account.findUniqueOrThrow({
      where: { code: STANDARD_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE },
    });

    const payment = await this.prisma.$transaction(async (tx) => {
      for (const alloc of dto.allocations) {
        const invoice = await tx.invoice.findUnique({ where: { id: alloc.invoiceId } });
        if (!invoice) {
          throw new NotFoundException(`ไม่พบใบแจ้งหนี้ ${alloc.invoiceId}`);
        }
        if (invoice.status !== InvoiceStatus.SENT && invoice.status !== InvoiceStatus.PARTIALLY_PAID) {
          throw new BadRequestException(`ใบแจ้งหนี้เลขที่ ${invoice.number} ไม่อยู่ในสถานะที่รับเงินได้`);
        }
        const remaining = await this.getInvoiceRemainingBalance(alloc.invoiceId, tx);
        if (alloc.amount > remaining + 0.01) {
          throw new BadRequestException(
            `ยอดรับเงินเกินยอดคงเหลือของใบแจ้งหนี้เลขที่ ${invoice.number} (คงเหลือ ${remaining})`,
          );
        }
      }

      const created = await tx.payment.create({
        data: {
          direction: PaymentDirection.RECEIVE,
          amount: dto.amount,
          method: dto.method,
          status: PaymentStatus.COMPLETED,
          paymentDate: new Date(),
          proposedById: userId,
          allocations: {
            create: dto.allocations.map((a) => ({ invoiceId: a.invoiceId, amount: a.amount })),
          },
        },
        include: { allocations: true },
      });

      await this.journal.postEntry(
        {
          entryDate: new Date(),
          description: 'รับชำระเงินจากลูกค้า',
          sourceType: 'PAYMENT',
          sourceId: created.id,
          createdById: userId,
          lines: [
            { accountId: bankAccount.id, debit: dto.amount },
            { accountId: arAccount.id, credit: dto.amount },
          ],
        },
        tx,
      );

      for (const alloc of dto.allocations) {
        await this.updateInvoiceStatusAfterPayment(alloc.invoiceId, tx);
      }

      return created;
    });

    await this.audit.log({
      userId,
      action: 'RECEIVE',
      entityType: 'Payment',
      entityId: payment.id,
      after: payment,
    });
    return payment;
  }

  async approve(id: string, approverId: string, approverRole: Role) {
    const payment = await this.findOne(id);
    if (payment.direction !== PaymentDirection.PAY) {
      throw new BadRequestException('อนุมัติได้เฉพาะรายการจ่ายเงินขาออกเท่านั้น');
    }

    const pendingApproval = payment.approvals
      .filter((a) => a.decision === ApprovalDecision.PENDING)
      .sort((a, b) => a.level - b.level)[0];
    if (!pendingApproval) {
      throw new BadRequestException('ไม่มีขั้นตอนอนุมัติที่รออยู่สำหรับรายการนี้');
    }
    if (pendingApproval.level === 1 && approverRole !== Role.CFO && approverRole !== Role.CEO) {
      throw new ForbiddenException('ต้องเป็น CFO หรือ CEO เท่านั้นที่อนุมัติขั้นนี้ได้');
    }
    if (pendingApproval.level === 2 && approverRole !== Role.CEO) {
      throw new ForbiddenException('ต้องเป็น CEO เท่านั้นที่อนุมัติวงเงินนี้');
    }

    const paymentAmount = Number(payment.amount);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.paymentApproval.update({
        where: { id: pendingApproval.id },
        data: { decision: ApprovalDecision.APPROVED, approverId, decidedAt: new Date() },
      });

      const remainingApprovals = await tx.paymentApproval.count({
        where: { paymentId: id, decision: ApprovalDecision.PENDING },
      });

      if (remainingApprovals > 0) {
        const updated = await tx.payment.update({
          where: { id },
          data: { status: PaymentStatus.PENDING_CEO_APPROVAL },
        });
        return { payment: updated, completed: false };
      }

      const bankAccount = await tx.account.findUniqueOrThrow({
        where: { code: STANDARD_ACCOUNT_CODES.BANK },
      });
      const apAccount = await tx.account.findUniqueOrThrow({
        where: { code: STANDARD_ACCOUNT_CODES.ACCOUNTS_PAYABLE },
      });

      await this.journal.postEntry(
        {
          entryDate: new Date(),
          description: 'จ่ายชำระเงินให้ผู้รับเหมา/ซัพพลายเออร์',
          sourceType: 'PAYMENT',
          sourceId: id,
          createdById: approverId,
          lines: [
            { accountId: apAccount.id, debit: paymentAmount },
            { accountId: bankAccount.id, credit: paymentAmount },
          ],
        },
        tx,
      );

      const updated = await tx.payment.update({
        where: { id },
        data: { status: PaymentStatus.COMPLETED, paymentDate: new Date() },
      });

      for (const alloc of payment.allocations) {
        if (alloc.billId) {
          await this.updateBillStatusAfterPayment(alloc.billId, tx);
        }
      }

      return { payment: updated, completed: true };
    });

    await this.audit.log({
      userId: approverId,
      action: result.completed ? 'COMPLETE' : 'APPROVE',
      entityType: 'Payment',
      entityId: id,
      before: payment,
      after: result.payment,
    });
    return result.payment;
  }

  async reject(id: string, approverId: string, approverRole: Role, comment?: string) {
    const payment = await this.findOne(id);
    const pendingApproval = payment.approvals
      .filter((a) => a.decision === ApprovalDecision.PENDING)
      .sort((a, b) => a.level - b.level)[0];
    if (!pendingApproval) {
      throw new BadRequestException('ไม่มีขั้นตอนอนุมัติที่รออยู่สำหรับรายการนี้');
    }
    if (pendingApproval.level === 1 && approverRole !== Role.CFO && approverRole !== Role.CEO) {
      throw new ForbiddenException('ต้องเป็น CFO หรือ CEO เท่านั้นที่ปฏิเสธขั้นนี้ได้');
    }
    if (pendingApproval.level === 2 && approverRole !== Role.CEO) {
      throw new ForbiddenException('ต้องเป็น CEO เท่านั้นที่ปฏิเสธวงเงินนี้');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.paymentApproval.update({
        where: { id: pendingApproval.id },
        data: { decision: ApprovalDecision.REJECTED, approverId, decidedAt: new Date(), comment },
      });
      return tx.payment.update({ where: { id }, data: { status: PaymentStatus.REJECTED } });
    });

    await this.audit.log({
      userId: approverId,
      action: 'REJECT',
      entityType: 'Payment',
      entityId: id,
      before: payment,
      after: updated,
    });
    return updated;
  }
}
