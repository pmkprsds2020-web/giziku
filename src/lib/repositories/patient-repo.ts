// CareLivia — Repository: Patient
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const patientRepo = {
  async list() {
    return db.patient.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        diagnoses: { where: { active: true } },
      },
    });
  },

  async get(id: string) {
    return db.patient.findUnique({
      where: { id },
      include: {
        diagnoses: { orderBy: { createdAt: "desc" } },
        anthropometry: { orderBy: { recordedAt: "desc" }, take: 10 },
        assessments: { orderBy: { recordedAt: "desc" }, take: 5 },
        weightRecords: { orderBy: { date: "asc" }, take: 30 },
        mealPlans: { orderBy: { date: "desc" }, take: 10, include: { items: true } },
      },
    });
  },

  async create(data: Prisma.PatientCreateInput) {
    return db.patient.create({ data });
  },

  async update(id: string, data: Prisma.PatientUpdateInput) {
    return db.patient.update({ where: { id }, data });
  },

  async softDelete(id: string) {
    return db.patient.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};
