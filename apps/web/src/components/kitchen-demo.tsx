import { AlertCircle, Clock3, Hash } from "lucide-react";
import { demoKitchenTickets } from "@/lib/demo-data";

const statusClass = {
  Novo: "new",
  Preparando: "preparing",
  Pronto: "ready",
} as const;

export function KitchenDemo() {
  return (
    <section aria-labelledby="kitchen-demo-heading">
      <div className="notice kitchen-notice">
        <AlertCircle aria-hidden="true" size={17} />
        <div>
          <strong>Prévia demonstrativa, sem integração.</strong> Os pedidos são exemplos estáticos.
          Ações de preparo, som, persistência e atualização em tempo real ainda não estão
          implementados.
        </div>
      </div>

      <div className="kitchen-board-heading">
        <div>
          <h2 id="kitchen-demo-heading">Fila de exemplo</h2>
          <p>Identificador de comanda exibido junto à mesa para diferenciar pedidos.</p>
        </div>
        <span className="static-tag">Pedidos estáticos</span>
      </div>

      <div aria-label="Pedidos ilustrativos da cozinha" className="kitchen-board">
        {demoKitchenTickets.map((ticket) => {
          const headingId = `ticket-${ticket.id}`;
          return (
            <article aria-labelledby={headingId} className="ticket-card" key={ticket.id}>
              <div className="ticket-topline">
                <span className="ticket-order" id={headingId}>
                  {ticket.kind === "restock" ? "Reposição" : "Pedido"} #{ticket.orderNumber}
                </span>
                <span className={`status-pill ${statusClass[ticket.status]}`}>{ticket.status}</span>
              </div>
              {ticket.kind !== "restock" ? <h3>{ticket.table}</h3> : null}
              <p className="ticket-check">
                <Hash aria-hidden="true" size={14} />
                {ticket.kind === "restock" ? "Solicitação" : "Comanda"} <strong>{ticket.checkId}</strong>
              </p>
              <ul className="ticket-items">
                {ticket.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="ticket-time">
                <Clock3 aria-hidden="true" size={14} />
                Recebido há {ticket.elapsed}
              </div>
            </article>
          );
        })}
      </div>

      <p className="footer-note">
        Exemplo intencional: Mesa 08 aparece em dois pedidos diferentes, cada um com identificador
        de comanda próprio. O MVP permite múltiplas comandas abertas por mesa. O último card
        demonstra uma reposição de buffet — um tipo de solicitação da área de buffet para a
        cozinha, sem mesa ou comanda de cliente associada. Esta tela não é uma fila operacional.
      </p>
    </section>
  );
}
