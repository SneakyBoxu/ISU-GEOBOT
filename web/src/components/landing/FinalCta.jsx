import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Button from '../ui/Button.jsx';

export default function FinalCta() {
  return (
    <section className="py-20 sm:py-28">
      <div className="container-x">
        <div className="grid items-end gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <h2 className="max-w-prose font-serif text-h1 leading-[1.1] text-fg">
              Ask it where something is. Ask it whether someone is free.
            </h2>
            <p className="lede mt-5">
              The assistant and the campus map are open to everyone. Faculty
              availability requires a campus account.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:shrink-0">
            <Button as={Link} to="/app" variant="primary" size="lg" iconRight={ArrowRight}>
              Launch Assistant
            </Button>
            <Button as={Link} to="/validate" variant="secondary" size="lg">
              Faculty portal
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
