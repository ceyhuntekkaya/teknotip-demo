export const DEMO_USERNAME = "teknotıp";
export const DEMO_PASSWORD = "teknotıp";
export const DEMO_SESSION_COOKIE = "teknotip-demo";

export function normalizeDemoSecret(value: string): string {
  return value.trim().toLocaleLowerCase("tr").replaceAll("ı", "i");
}

export function isDemoLogin(username: string, password: string): boolean {
  return (
    normalizeDemoSecret(username) === normalizeDemoSecret(DEMO_USERNAME) &&
    normalizeDemoSecret(password) === normalizeDemoSecret(DEMO_PASSWORD)
  );
}
