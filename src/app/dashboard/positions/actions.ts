"use server";

import { createNC, updateNC, removeNC } from "@/lib/crud/name-code";
import type { NCInput, CrudResult } from "@/lib/crud/types";

export async function createPosition(input: NCInput): Promise<CrudResult> { return createNC("positions", input); }
export async function updatePosition(id: string, input: NCInput): Promise<CrudResult> { return updateNC("positions", id, input); }
export async function deletePositions(ids: string[]): Promise<CrudResult> { return removeNC("positions", ids); }
