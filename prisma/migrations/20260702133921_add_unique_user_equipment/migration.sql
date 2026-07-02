/*
  Warnings:

  - A unique constraint covering the columns `[userId,equipmentId]` on the table `user_equipment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "user_equipment_userId_equipmentId_key" ON "user_equipment"("userId", "equipmentId");
