import { http } from "./client";

export interface AuthUser {
  id: number;
  name: string | null;
  email: string;
  tenant_id: number;
  status: string;
  teams: string[];
  role: string | null;
}

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  const { data } = await http.post("/auth/login", { email, password });
  return data;
}

export async function fetchMe(): Promise<{ user: AuthUser }> {
  const { data } = await http.get("/auth/me");
  return data;
}
