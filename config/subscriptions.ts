export const subscriptionPlans = {
  "price_1Rc3KZIe4PsbLJO4f9Ol0Cvs": {
    name: "ConsulLight",
    description: "Ideale per iniziare e per esigenze di base.",
  },
  "price_1Rc3LFIe4PsbLJO4nLFy2p3i": {
    name: "ConsulPro",
    description: "Perfetto per professionisti e utenti regolari.",
  },
  "price_1Rc3LpIe4PsbLJO4ETiGG41d": {
    name: "ConsulExpert",
    description: "La soluzione completa per studi legali e aziende.",
  },
};

export type SubscriptionPlanName = keyof typeof subscriptionPlans;
