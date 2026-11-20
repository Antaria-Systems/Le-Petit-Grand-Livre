/** Valeur de configuration, ou repère visible si elle n'est pas encore renseignée. */
export function ACompleter({ valeur, libelle }: { valeur: string; libelle: string }) {
  return valeur ? <>{valeur}</> : <span className="a-completer">[{libelle} à compléter]</span>;
}
