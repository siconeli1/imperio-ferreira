# Imperio Ferreira

Projeto Next.js App Router para a barbearia Imperio Ferreira, reconstruido com base conceitual na `conceito-barbearia` e adaptado para operacao multi-barbeiro.

## Stack

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Supabase / PostgreSQL

## O que foi implementado

- Home institucional com nova identidade visual
- Fluxo de agendamento com escolha de servico, data, barbeiro especifico ou `qualquer um disponivel`
- Reserva confirmada no backend com selecao real do barbeiro quando o cliente escolhe `qualquer`
- Area administrativa com login individual por barbeiro
- Agenda filtrada por sessao do barbeiro logado
- Bloqueios e horarios personalizados por barbeiro
- Consulta de meus agendamentos por celular com cancelamento
- Migration SQL inicial para barbeiros, servicos, agendamentos, bloqueios e horarios personalizados

## Variaveis de ambiente

Crie um arquivo `.env.local` com:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_SESSION_SECRET=
```

## Como rodar

```bash
npm install
npm run dev
```

## Validacao local

```bash
npm run lint
npm run build
```
