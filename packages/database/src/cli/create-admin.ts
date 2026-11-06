import * as argon2 from "argon2";
import { createId } from "@mudra/shared";
import { PrismaClient, type Prisma } from "@prisma/client";
import { stdin, stderr, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { StringDecoder } from "node:string_decoder";

const BOOTSTRAP_LOCK_NAMESPACE = 1297439826;

class CliError extends Error {}
class BootstrapAlreadyCompletedError extends Error {}

function safeFailureReason(error: unknown): string {
  if (!(error instanceof Error)) return "erro inesperado";

  if (
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    /^P\d{4}$/.test(error.code)
  ) {
    return `erro de persistência ${error.code}`;
  }
  return error.name || "erro inesperado";
}

function requiredEnvironmentVariable(name: "DATABASE_URL"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new CliError(`Defina ${name} antes de executar o bootstrap.`);
  }
  return value;
}

async function promptVisibleFields(): Promise<{
  restaurantName: string;
  email: string;
  displayName: string;
}> {
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    return {
      restaurantName: (await readline.question("Nome do restaurante: ")).trim(),
      email: (await readline.question("Email do administrador: ")).trim(),
      displayName: (await readline.question("Nome de exibição: ")).trim(),
    };
  } finally {
    readline.close();
  }
}

/** Reads the password directly from a TTY in raw mode; typed characters are never echoed. */
async function promptHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== "function") {
    throw new CliError("A senha deve ser informada em um terminal interativo (TTY).");
  }

  return new Promise<string>((resolve, reject) => {
    const decoder = new StringDecoder("utf8");
    let password = "";
    let finished = false;

    const finish = (error?: Error): void => {
      if (finished) return;
      finished = true;
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      if (error) reject(error);
      else resolve(password);
    };

    const onData = (chunk: Buffer): void => {
      for (const character of decoder.write(chunk)) {
        if (character === "\u0003" || character === "\u0004") {
          finish(new CliError("Leitura da senha cancelada."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          password = Array.from(password).slice(0, -1).join("");
          continue;
        }
        if (character >= " ") password += character;
      }
    };

    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function createBootstrap(prisma: PrismaClient, data: {
  restaurantName: string;
  email: string;
  displayName: string;
  passwordHash: string;
}): Promise<{ restaurantId: string; adminId: string }> {
  return prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
    // Serialize bootstrap attempts, including concurrent CLI processes.
    await transaction.$queryRaw`
      SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK_NAMESPACE}::integer, 1::integer) IS NOT NULL AS "locked"
    `;

    if ((await transaction.restaurant.count()) > 0) {
      throw new BootstrapAlreadyCompletedError();
    }

    const restaurantId = createId();
    const adminId = createId();

    await transaction.restaurant.create({
      data: {
        id: restaurantId,
        name: data.restaurantName,
      },
    });

    await transaction.user.create({
      data: {
        id: adminId,
        restaurantId,
        name: data.displayName,
        email: data.email,
        passwordHash: data.passwordHash,
        role: "ADMIN",
      },
    });

    return { restaurantId, adminId };
  });
}

async function main(): Promise<void> {
  let prisma: PrismaClient | undefined;

  try {
    const databaseUrl = requiredEnvironmentVariable("DATABASE_URL");
    const { restaurantName, email, displayName } = await promptVisibleFields();

    if (!restaurantName || !email || !displayName) {
      throw new CliError("Nome do restaurante, email e nome de exibição são obrigatórios.");
    }
    if (!email.includes("@") || /\s/.test(email)) {
      throw new CliError("Informe um email válido.");
    }

    const password = await promptHidden("Senha do administrador (entrada oculta): ");
    if (!password) throw new CliError("A senha não pode ficar vazia.");

    // argon2 creates a cryptographically random salt and stores it in the
    // encoded Argon2id hash. The clear-text password is never persisted/logged.
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    const result = await createBootstrap(prisma, {
      restaurantName,
      email,
      displayName,
      passwordHash,
    });

    stdout.write(
      `Bootstrap concluído. Restaurante: ${result.restaurantId}; administrador: ${result.adminId} (${email}).\n`,
    );
  } catch (error) {
    if (error instanceof BootstrapAlreadyCompletedError) {
      stderr.write("Bootstrap recusado: já existe um restaurante neste banco de dados.\n");
    } else if (error instanceof CliError) {
      stderr.write(`${error.message}\n`);
    } else {
      // Avoid printing Prisma errors, input values, connection strings or hashes.
      stderr.write(
        `Bootstrap falhou (${safeFailureReason(error)}); nenhum dado de credencial foi exibido. Verifique a conexão e o banco.\n`,
      );
    }
    process.exitCode = 1;
  } finally {
    await prisma?.$disconnect();
  }
}

void main();
