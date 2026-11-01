import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const employeePassword = process.env.DEMO_EMPLOYEE_PASSWORD;
const analystPassword = process.env.DEMO_ANALYST_PASSWORD;
const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;

if (!employeePassword || !analystPassword || !adminPassword || !adminEmail) {
  console.error('Set demo and bootstrap credentials before capturing screenshots.');
  process.exitCode = 1;
} else {
  await mkdir('docs/screenshots', { recursive: true });
  const browser = await chromium.launch({ headless: true });

  async function signIn(context, email, password) {
    const page = await context.newPage();
    await page.goto(`${baseURL}/login`);
    await page.getByLabel('E-mail corporativo').fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(password);
    await page.getByRole('button', { name: /Entrar na plataforma/ }).click();
    await page.waitForURL(/\/(chat|console)/);
    return page;
  }

  const employee = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const login = await employee.newPage();
  await login.goto(`${baseURL}/login`);
  await login.screenshot({ path: 'docs/screenshots/login.png', fullPage: true });
  await login.close();

  const employeePage = await signIn(employee, 'ana.souza@nexo.com.br', employeePassword);
  await employeePage.getByRole('button', { name: '+ Nova conversa', exact: true }).click();
  await employeePage.getByRole('button', { name: 'Abrir chamado' }).click();
  await employeePage.getByLabel('Título').fill('Notebook sem acesso à VPN');
  await employeePage
    .getByLabel('Descrição')
    .fill('Meu notebook não conecta à VPN corporativa desde esta manhã.');
  await employeePage.getByRole('button', { name: 'Preparar rascunho' }).click();
  await employeePage.getByText('Rascunho para confirmação').waitFor();
  await employeePage.screenshot({ path: 'docs/screenshots/chat-ticket-draft.png', fullPage: true });

  await employeePage.getByRole('button', { name: '+ Nova conversa', exact: true }).click();
  await employeePage.getByRole('button', { name: 'Falar com analista' }).click();
  await employeePage.reload();
  await employeePage.getByText('Aguardando atendente. O assistente está pausado.').waitFor();
  await employeePage.screenshot({ path: 'docs/screenshots/chat-handoff.png', fullPage: true });

  await employeePage.goto(`${baseURL}/profile`);
  await employeePage.screenshot({ path: 'docs/screenshots/profile.png', fullPage: true });

  const analyst = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const analystPage = await signIn(analyst, 'rafael.lima@nexo.com.br', analystPassword);
  await analystPage.goto(`${baseURL}/console`);
  await analystPage.getByRole('button', { name: 'Assumir atendimento' }).waitFor();
  await analystPage.screenshot({ path: 'docs/screenshots/console-queue.png', fullPage: true });
  await analystPage.getByRole('button', { name: 'Assumir atendimento' }).click();
  await analystPage.getByRole('button', { name: 'Devolver ao agent' }).waitFor();
  await analystPage.setViewportSize({ width: 1567, height: 900 });
  await analystPage.screenshot({ path: 'docs/screenshots/console-claimed.png', fullPage: true });

  const admin = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const adminPage = await signIn(admin, adminEmail, adminPassword);
  await adminPage.goto(`${baseURL}/admin/users`);
  await adminPage.getByRole('cell', { name: 'Ana Souza' }).waitFor();
  await adminPage.screenshot({ path: 'docs/screenshots/admin-users.png', fullPage: true });

  await browser.close();
  console.info('Captured 7 screenshots in docs/screenshots/.');
}
