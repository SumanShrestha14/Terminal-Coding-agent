import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import {PrismaClient} from "../generated/prisma/client"

const dbUrl = process.env.DATABASE_URL

if(!dbUrl) {
    throw new Error("DATABASE_URL is not defined in environment variables.")
}

const adapter = new PrismaPg({connectionString: dbUrl})

export const db = new PrismaClient({adapter})