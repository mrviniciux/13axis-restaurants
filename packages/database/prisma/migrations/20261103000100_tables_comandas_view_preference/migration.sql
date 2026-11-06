CREATE TYPE "TablesComandasView" AS ENUM ('COMANDA', 'MESA', 'MESA_E_COMANDA');

ALTER TABLE "User"
ADD COLUMN "tablesComandasView" "TablesComandasView" NOT NULL DEFAULT 'COMANDA';
