import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// S2.3: fecha as inscrições de editais cujo prazo passou.
crons.interval(
  "fechar editais vencidos",
  { minutes: 15 },
  internal.editais.mutations.fecharVencidos,
);

export default crons;
