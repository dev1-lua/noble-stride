import { prisma } from "@/lib/db";

export async function listUsers() {
  return prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}
