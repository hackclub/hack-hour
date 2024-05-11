import { PrismaClient } from '@prisma/client';
import cuid2 from '@paralleldrive/cuid2';

cuid2.init();

export const prisma = new PrismaClient();
export const uid = () => { return cuid2.createId() };