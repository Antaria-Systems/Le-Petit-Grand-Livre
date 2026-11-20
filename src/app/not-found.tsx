import Link from "next/link";

export default function Introuvable() {
  return (
    <section className="section">
      <div className="conteneur prose">
        <h1>Page introuvable</h1>
        <p>Cette page n&apos;existe pas ou plus. La commune que vous cherchez n&apos;est peut-être pas encore couverte.</p>
        <p>
          <Link href="/">Retour à l&apos;accueil</Link>
        </p>
      </div>
    </section>
  );
}
