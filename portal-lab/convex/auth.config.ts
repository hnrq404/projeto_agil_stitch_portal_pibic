// Config de autenticação do lado do backend (exigida pelo @convex-dev/auth).
// Diz ao Convex como verificar os JWTs emitidos pelo próprio provedor
// (o domínio é a URL das HTTP actions deste deployment).
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
