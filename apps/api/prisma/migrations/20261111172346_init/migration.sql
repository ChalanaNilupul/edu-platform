-- CreateTable
CREATE TABLE "database_health" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "database_health_pkey" PRIMARY KEY ("id")
);
