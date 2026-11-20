/** Vérifie la connexion au relais SMTP (TLS + authentification éventuelle). N'envoie aucun message. */
import "dotenv/config";
import { expediteur, transporteur } from "../src/lib/mail";

transporteur()
  .verify()
  .then(() => console.log(`Relais SMTP ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} joignable, TLS OK, expéditeur ${expediteur().address}`))
  .catch((e) => {
    console.error("Échec :", e.message);
    process.exitCode = 1;
  });
