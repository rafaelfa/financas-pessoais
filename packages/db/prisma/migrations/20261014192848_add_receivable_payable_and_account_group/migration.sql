-- CreateEnum
CREATE TYPE "ReceivablePayableStatus" AS ENUM ('OPEN', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceivablePayableType" AS ENUM ('PAYABLE', 'RECEIVABLE');

-- CreateTable
CREATE TABLE "receivable_payable" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReceivablePayableType" NOT NULL,
    "description" TEXT NOT NULL,
    "amountInCents" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "paidAt" TIMESTAMP(3),
    "categoryId" TEXT,
    "financialAccountId" TEXT,
    "tags" TEXT[],
    "note" TEXT,
    "status" "ReceivablePayableStatus" NOT NULL DEFAULT 'OPEN',
    "paidAmountInCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receivable_payable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receivable_payable_payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "receivablePayableId" TEXT NOT NULL,
    "financialAccountId" TEXT,
    "amountInCents" INTEGER NOT NULL,
    "paymentDate" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receivable_payable_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_group" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_group_item" (
    "id" TEXT NOT NULL,
    "accountGroupId" TEXT NOT NULL,
    "financialAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_group_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "receivable_payable_userId_status_dueDate_idx" ON "receivable_payable"("userId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "receivable_payable_userId_categoryId_idx" ON "receivable_payable"("userId", "categoryId");

-- CreateIndex
CREATE INDEX "receivable_payable_financialAccountId_idx" ON "receivable_payable"("financialAccountId");

-- CreateIndex
CREATE INDEX "receivable_payable_payment_userId_paymentDate_idx" ON "receivable_payable_payment"("userId", "paymentDate");

-- CreateIndex
CREATE INDEX "receivable_payable_payment_receivablePayableId_paymentDate_idx" ON "receivable_payable_payment"("receivablePayableId", "paymentDate");

-- CreateIndex
CREATE INDEX "receivable_payable_payment_financialAccountId_idx" ON "receivable_payable_payment"("financialAccountId");

-- CreateIndex
CREATE INDEX "account_group_userId_idx" ON "account_group"("userId");

-- CreateIndex
CREATE INDEX "account_group_item_financialAccountId_idx" ON "account_group_item"("financialAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "account_group_item_accountGroupId_financialAccountId_key" ON "account_group_item"("accountGroupId", "financialAccountId");

-- AddForeignKey
ALTER TABLE "receivable_payable" ADD CONSTRAINT "receivable_payable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_payable" ADD CONSTRAINT "receivable_payable_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_payable" ADD CONSTRAINT "receivable_payable_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "financial_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_payable_payment" ADD CONSTRAINT "receivable_payable_payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_payable_payment" ADD CONSTRAINT "receivable_payable_payment_receivablePayableId_fkey" FOREIGN KEY ("receivablePayableId") REFERENCES "receivable_payable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_payable_payment" ADD CONSTRAINT "receivable_payable_payment_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "financial_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_group" ADD CONSTRAINT "account_group_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_group_item" ADD CONSTRAINT "account_group_item_accountGroupId_fkey" FOREIGN KEY ("accountGroupId") REFERENCES "account_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_group_item" ADD CONSTRAINT "account_group_item_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "financial_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
