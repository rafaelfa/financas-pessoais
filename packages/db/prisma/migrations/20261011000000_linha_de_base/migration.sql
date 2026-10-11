-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountingBasis" AS ENUM ('CASH', 'ACCRUAL');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'WALLET', 'CASH', 'INVESTMENT', 'CREDIT_CARD');

-- CreateEnum
CREATE TYPE "AccountOrigin" AS ENUM ('MANUAL', 'IMPORTED');

-- CreateEnum
CREATE TYPE "CardBrand" AS ENUM ('VISA', 'MASTERCARD', 'MAESTRO', 'AMERICAN_EXPRESS', 'MULTIBANCO', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'CLOSED', 'PAID');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('EXPENSE', 'INCOME');

-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('EXPENSE', 'INCOME', 'TRANSFER', 'INVOICE_PAYMENT', 'GOAL_DEPOSIT', 'GOAL_WITHDRAWAL', 'BALANCE_ADJUST');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IGNORED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "PaymentCondition" AS ENUM ('SINGLE', 'INSTALLMENT', 'RECURRING');

-- CreateEnum
CREATE TYPE "TransactionOrigin" AS ENUM ('MANUAL', 'IMPORTED', 'RECURRENCE');

-- CreateEnum
CREATE TYPE "TransactionRuleAction" AS ENUM ('SET_CATEGORY', 'SET_TAGS', 'SET_DESCRIPTION', 'MARK_IGNORED');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "BudgetScope" AS ENUM ('SINGLE_MONTH', 'MONTHLY_DEFAULT');

-- CreateEnum
CREATE TYPE "GoalState" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GoalMovementType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'YIELD');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('VEHICLE', 'PROPERTY', 'OTHER');

-- CreateEnum
CREATE TYPE "LiabilityType" AS ENUM ('LOAN', 'MORTGAGE', 'CREDIT_LINE', 'OTHER');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "monthStartDay" INTEGER NOT NULL DEFAULT 1,
    "accountingBasis" "AccountingBasis" NOT NULL DEFAULT 'CASH',
    "primaryAccountId" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "institution" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "openingBalanceInCents" INTEGER NOT NULL DEFAULT 0,
    "balanceInCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "origin" "AccountOrigin" NOT NULL DEFAULT 'MANUAL',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locked_balance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financialAccountId" TEXT NOT NULL,
    "referenceDate" DATE NOT NULL,
    "reportedBalanceInCents" INTEGER NOT NULL,
    "computedBalanceInCents" INTEGER NOT NULL,
    "adjustmentInCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locked_balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_card" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "paymentAccountId" TEXT,
    "brand" "CardBrand" NOT NULL DEFAULT 'OTHER',
    "closingDay" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "creditLimitInCents" INTEGER,
    "availableLimitInCents" INTEGER,
    "annualFeeInCents" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "closingDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "totalAmountInCents" INTEGER NOT NULL DEFAULT 0,
    "paidAmountInCents" INTEGER NOT NULL DEFAULT 0,
    "carriedOverInCents" INTEGER NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "financialAccountId" TEXT,
    "amountInCents" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "transactionId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "parentId" TEXT,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "color" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "TransactionKind" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'CONFIRMED',
    "amountInCents" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "financialAccountId" TEXT,
    "cardId" TEXT,
    "invoiceId" TEXT,
    "categoryId" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'DEBIT',
    "paymentCondition" "PaymentCondition" NOT NULL DEFAULT 'SINGLE',
    "installmentCount" INTEGER,
    "installmentNumber" INTEGER,
    "installmentPlanId" TEXT,
    "installmentAmountInCents" INTEGER,
    "transferGroupId" TEXT,
    "counterpartTransactionId" TEXT,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "settledOn" DATE,
    "goalId" TEXT,
    "recurrenceId" TEXT,
    "fitId" TEXT,
    "origin" "TransactionOrigin" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_rule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "descriptionContains" TEXT,
    "counterparty" TEXT,
    "amountMinInCents" INTEGER,
    "amountMaxInCents" INTEGER,
    "dayMin" INTEGER,
    "dayMax" INTEGER,
    "financialAccountId" TEXT,
    "cardId" TEXT,
    "action" "TransactionRuleAction" NOT NULL DEFAULT 'SET_CATEGORY',
    "targetCategoryId" TEXT,
    "targetTagNames" TEXT[],
    "appliedCount" INTEGER NOT NULL DEFAULT 0,
    "lastAppliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurrence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "TransactionKind" NOT NULL,
    "amountInCents" INTEGER NOT NULL,
    "description" TEXT,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "dayOfMonth" INTEGER,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "nextRunDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "financialAccountId" TEXT,
    "categoryId" TEXT,
    "templateTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "BudgetScope" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE,
    "totalAmountInCents" INTEGER NOT NULL,
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_limit" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amountInCents" INTEGER NOT NULL,
    "alertThresholdPct" INTEGER,
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_limit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPreset" BOOLEAN NOT NULL DEFAULT false,
    "targetAmountInCents" INTEGER NOT NULL,
    "initialReservedInCents" INTEGER NOT NULL DEFAULT 0,
    "targetDate" DATE NOT NULL,
    "contributionFrequency" "RecurrenceFrequency" NOT NULL DEFAULT 'MONTHLY',
    "requiredContributionInCents" INTEGER,
    "reminderFrequency" "RecurrenceFrequency",
    "deadlineAlert" BOOLEAN NOT NULL DEFAULT false,
    "state" "GoalState" NOT NULL DEFAULT 'ACTIVE',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_movement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "type" "GoalMovementType" NOT NULL,
    "amountInCents" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "transactionId" TEXT,
    "invoiceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "valueInCents" INTEGER NOT NULL,
    "acquiredOn" DATE,
    "valuedOn" DATE,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LiabilityType" NOT NULL,
    "name" TEXT NOT NULL,
    "creditor" TEXT,
    "principalInCents" INTEGER NOT NULL,
    "outstandingInCents" INTEGER NOT NULL,
    "interestRateBasisPoints" INTEGER,
    "totalInstallments" INTEGER,
    "remainingInstallments" INTEGER,
    "installmentAmountInCents" INTEGER,
    "startDate" DATE,
    "endDate" DATE,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "month_close" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "month_close_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TransactionTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TransactionTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_primaryAccountId_key" ON "user"("primaryAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "financial_account_userId_archivedAt_idx" ON "financial_account"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "financial_account_userId_type_idx" ON "financial_account"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "financial_account_userId_name_key" ON "financial_account"("userId", "name");

-- CreateIndex
CREATE INDEX "locked_balance_userId_referenceDate_idx" ON "locked_balance"("userId", "referenceDate");

-- CreateIndex
CREATE INDEX "locked_balance_financialAccountId_referenceDate_idx" ON "locked_balance"("financialAccountId", "referenceDate");

-- CreateIndex
CREATE UNIQUE INDEX "locked_balance_financialAccountId_referenceDate_key" ON "locked_balance"("financialAccountId", "referenceDate");

-- CreateIndex
CREATE INDEX "credit_card_userId_archivedAt_idx" ON "credit_card"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "credit_card_paymentAccountId_idx" ON "credit_card"("paymentAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_card_userId_name_key" ON "credit_card"("userId", "name");

-- CreateIndex
CREATE INDEX "invoice_userId_status_dueDate_idx" ON "invoice"("userId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "invoice_cardId_dueDate_idx" ON "invoice"("cardId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_cardId_closingDate_key" ON "invoice"("cardId", "closingDate");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_payment_transactionId_key" ON "invoice_payment"("transactionId");

-- CreateIndex
CREATE INDEX "invoice_payment_userId_date_idx" ON "invoice_payment"("userId", "date");

-- CreateIndex
CREATE INDEX "invoice_payment_invoiceId_date_idx" ON "invoice_payment"("invoiceId", "date");

-- CreateIndex
CREATE INDEX "invoice_payment_financialAccountId_idx" ON "invoice_payment"("financialAccountId");

-- CreateIndex
CREATE INDEX "category_userId_kind_archivedAt_idx" ON "category"("userId", "kind", "archivedAt");

-- CreateIndex
CREATE INDEX "category_parentId_idx" ON "category"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "category_userId_kind_slug_key" ON "category"("userId", "kind", "slug");

-- CreateIndex
CREATE INDEX "tag_userId_idx" ON "tag"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tag_userId_name_key" ON "tag"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_counterpartTransactionId_key" ON "transaction"("counterpartTransactionId");

-- CreateIndex
CREATE INDEX "transaction_userId_date_idx" ON "transaction"("userId", "date");

-- CreateIndex
CREATE INDEX "transaction_financialAccountId_date_idx" ON "transaction"("financialAccountId", "date");

-- CreateIndex
CREATE INDEX "transaction_userId_kind_status_idx" ON "transaction"("userId", "kind", "status");

-- CreateIndex
CREATE INDEX "transaction_userId_date_kind_status_idx" ON "transaction"("userId", "date", "kind", "status");

-- CreateIndex
CREATE INDEX "transaction_categoryId_date_idx" ON "transaction"("categoryId", "date");

-- CreateIndex
CREATE INDEX "transaction_cardId_date_idx" ON "transaction"("cardId", "date");

-- CreateIndex
CREATE INDEX "transaction_invoiceId_idx" ON "transaction"("invoiceId");

-- CreateIndex
CREATE INDEX "transaction_goalId_date_idx" ON "transaction"("goalId", "date");

-- CreateIndex
CREATE INDEX "transaction_recurrenceId_idx" ON "transaction"("recurrenceId");

-- CreateIndex
CREATE INDEX "transaction_transferGroupId_idx" ON "transaction"("transferGroupId");

-- CreateIndex
CREATE INDEX "transaction_installmentPlanId_idx" ON "transaction"("installmentPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_financialAccountId_fitId_key" ON "transaction"("financialAccountId", "fitId");

-- CreateIndex
CREATE INDEX "transaction_rule_userId_enabled_priority_idx" ON "transaction_rule"("userId", "enabled", "priority");

-- CreateIndex
CREATE INDEX "transaction_rule_targetCategoryId_idx" ON "transaction_rule"("targetCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_rule_userId_name_key" ON "transaction_rule"("userId", "name");

-- CreateIndex
CREATE INDEX "recurrence_userId_isActive_nextRunDate_idx" ON "recurrence"("userId", "isActive", "nextRunDate");

-- CreateIndex
CREATE INDEX "recurrence_financialAccountId_idx" ON "recurrence"("financialAccountId");

-- CreateIndex
CREATE INDEX "recurrence_categoryId_idx" ON "recurrence"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "recurrence_userId_name_key" ON "recurrence"("userId", "name");

-- CreateIndex
CREATE INDEX "budget_userId_periodStart_idx" ON "budget"("userId", "periodStart");

-- CreateIndex
CREATE INDEX "budget_userId_scope_idx" ON "budget"("userId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "budget_userId_name_periodStart_key" ON "budget"("userId", "name", "periodStart");

-- CreateIndex
CREATE INDEX "budget_limit_budgetId_idx" ON "budget_limit"("budgetId");

-- CreateIndex
CREATE INDEX "budget_limit_categoryId_idx" ON "budget_limit"("categoryId");

-- CreateIndex
CREATE INDEX "budget_limit_userId_idx" ON "budget_limit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_limit_budgetId_categoryId_key" ON "budget_limit"("budgetId", "categoryId");

-- CreateIndex
CREATE INDEX "goal_userId_state_idx" ON "goal"("userId", "state");

-- CreateIndex
CREATE INDEX "goal_userId_targetDate_idx" ON "goal"("userId", "targetDate");

-- CreateIndex
CREATE INDEX "goal_movement_userId_date_idx" ON "goal_movement"("userId", "date");

-- CreateIndex
CREATE INDEX "goal_movement_goalId_date_idx" ON "goal_movement"("goalId", "date");

-- CreateIndex
CREATE INDEX "goal_movement_transactionId_idx" ON "goal_movement"("transactionId");

-- CreateIndex
CREATE INDEX "goal_movement_invoiceId_idx" ON "goal_movement"("invoiceId");

-- CreateIndex
CREATE INDEX "asset_userId_archivedAt_idx" ON "asset"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "liability_userId_archivedAt_idx" ON "liability"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "liability_userId_endDate_idx" ON "liability"("userId", "endDate");

-- CreateIndex
CREATE INDEX "month_close_userId_periodStart_idx" ON "month_close"("userId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "month_close_userId_periodStart_key" ON "month_close"("userId", "periodStart");

-- CreateIndex
CREATE INDEX "_TransactionTags_B_index" ON "_TransactionTags"("B");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_account" ADD CONSTRAINT "financial_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locked_balance" ADD CONSTRAINT "locked_balance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locked_balance" ADD CONSTRAINT "locked_balance_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "financial_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card" ADD CONSTRAINT "credit_card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card" ADD CONSTRAINT "credit_card_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "financial_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "credit_card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "financial_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag" ADD CONSTRAINT "tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "financial_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "credit_card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "recurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_counterpartTransactionId_fkey" FOREIGN KEY ("counterpartTransactionId") REFERENCES "transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_rule" ADD CONSTRAINT "transaction_rule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_rule" ADD CONSTRAINT "transaction_rule_targetCategoryId_fkey" FOREIGN KEY ("targetCategoryId") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence" ADD CONSTRAINT "recurrence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence" ADD CONSTRAINT "recurrence_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "financial_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence" ADD CONSTRAINT "recurrence_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget" ADD CONSTRAINT "budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_limit" ADD CONSTRAINT "budget_limit_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_limit" ADD CONSTRAINT "budget_limit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_limit" ADD CONSTRAINT "budget_limit_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal" ADD CONSTRAINT "goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_movement" ADD CONSTRAINT "goal_movement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_movement" ADD CONSTRAINT "goal_movement_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_movement" ADD CONSTRAINT "goal_movement_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_movement" ADD CONSTRAINT "goal_movement_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liability" ADD CONSTRAINT "liability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_close" ADD CONSTRAINT "month_close_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TransactionTags" ADD CONSTRAINT "_TransactionTags_A_fkey" FOREIGN KEY ("A") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TransactionTags" ADD CONSTRAINT "_TransactionTags_B_fkey" FOREIGN KEY ("B") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
