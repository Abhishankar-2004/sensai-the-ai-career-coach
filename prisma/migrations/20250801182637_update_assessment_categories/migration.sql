/*
  Warnings:

  - You are about to drop the column `category` on the `Assessment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Assessment" DROP COLUMN "category",
ADD COLUMN     "categories" TEXT[];
