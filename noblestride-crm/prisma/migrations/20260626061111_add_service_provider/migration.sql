-- CreateTable
CREATE TABLE "ServiceProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ServiceProviderType" NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "profile" TEXT,
    "fee" DECIMAL(20,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT,
    "createdSource" "ActorSource" NOT NULL DEFAULT 'HUMAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TransactionServiceProviders" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TransactionServiceProviders_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "ServiceProvider_type_idx" ON "ServiceProvider"("type");

-- CreateIndex
CREATE INDEX "_TransactionServiceProviders_B_index" ON "_TransactionServiceProviders"("B");

-- AddForeignKey
ALTER TABLE "_TransactionServiceProviders" ADD CONSTRAINT "_TransactionServiceProviders_A_fkey" FOREIGN KEY ("A") REFERENCES "ServiceProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TransactionServiceProviders" ADD CONSTRAINT "_TransactionServiceProviders_B_fkey" FOREIGN KEY ("B") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
