"use client";

import { useActionState } from "react";
import type { Etat } from "@/app/admin/actions";

/**
 * Formulaire relié à une action serveur : désactivé pendant l'envoi, message de résultat.
 * Confirmation : `confirmation` pour tout le formulaire, ou `data-confirmation` sur un bouton.
 */
export function FormulaireAction({
  action,
  children,
  className,
  confirmation,
}: {
  action: (e: Etat, f: FormData) => Promise<Etat>;
  children: React.ReactNode;
  className?: string;
  confirmation?: string;
}) {
  const [etat, executer, enCours] = useActionState(action, null);
  return (
    <form
      action={executer}
      className={className}
      onSubmit={(e) => {
        // Confirmation propre au bouton cliqué (data-confirmation), sinon celle du formulaire.
        const bouton = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const message = bouton?.dataset.confirmation ?? confirmation;
        if (message && !window.confirm(message)) e.preventDefault();
      }}
    >
      <fieldset disabled={enCours} className="formulaire-champs">
        {children}
      </fieldset>
      {enCours && <p className="discret petit" role="status">Enregistrement…</p>}
      {!enCours && etat?.ok && (
        <p className="badge badge-ok message-formulaire" role="status">
          {etat.ok}
        </p>
      )}
      {!enCours && etat?.erreur && (
        <p className="badge badge-alerte message-formulaire" role="alert">
          {etat.erreur}
        </p>
      )}
    </form>
  );
}
