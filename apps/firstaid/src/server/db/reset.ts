import { dataPlatform } from "~/server/data";
import { db } from "~/server/db";
import {
  benefits,
  careItems,
  careOrganizations,
  carePlans,
  claims,
  documents,
  filesTable,
  insurancePlans,
  people,
  providers,
  visits,
} from "~/server/db/schema";

export async function resetDatabase() {
  const state = await dataPlatform.settled();
  if (state.state !== "ready") {
    throw new Error(`Database is ${state.state}`);
  }
  await db.delete(documents);
  await db.delete(filesTable);
  await db.delete(claims);
  await db.delete(visits);
  await db.delete(benefits);
  await db.delete(insurancePlans);
  await db.delete(providers);
  await db.delete(careOrganizations);
  await db.delete(careItems);
  await db.delete(carePlans);
  await db.delete(people);
}
