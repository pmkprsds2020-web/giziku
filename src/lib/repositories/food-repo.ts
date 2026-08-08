// CareLivia — Repository: Food
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const foodRepo = {
  async search(opts: {
    q?: string;
    categoryId?: string;
    highProtein?: boolean;
    lowGi?: boolean;
    lowSodium?: boolean;
    highFiber?: boolean;
    limit?: number;
  }) {
    const where: Prisma.FoodWhereInput = {
      deletedAt: null,
      approved: true,
    };
    if (opts.q) {
      where.name = { contains: opts.q };
    }
    if (opts.categoryId) {
      where.categoryId = opts.categoryId;
    }
    if (opts.highProtein) where.protein = { gte: 10 };
    if (opts.lowGi) where.gi = { lt: 55, gt: 0 };
    if (opts.lowSodium) where.sodium = { lte: 100 };
    if (opts.highFiber) where.fiber = { gte: 3 };

    return db.food.findMany({
      where,
      include: { category: true },
      orderBy: { name: "asc" },
      take: opts.limit ?? 100,
    });
  },

  async get(id: string) {
    return db.food.findUnique({
      where: { id },
      include: { category: true, labels: true },
    });
  },

  async categories() {
    return db.foodCategory.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { foods: { where: { deletedAt: null } } } } },
    });
  },
};
