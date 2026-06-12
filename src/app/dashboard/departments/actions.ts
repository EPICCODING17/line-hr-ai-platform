"use server";

import { createNC, updateNC, removeNC } from "@/lib/crud/name-code";
import type { NCInput, CrudResult } from "@/lib/crud/types";

export async function createDepartment(input: NCInput): Promise<CrudResult> { return createNC("departments", input); }
export async function updateDepartment(id: string, input: NCInput): Promise<CrudResult> { return updateNC("departments", id, input); }
export async function deleteDepartments(ids: string[]): Promise<CrudResult> { return removeNC("departments", ids); }
