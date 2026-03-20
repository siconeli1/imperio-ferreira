import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/agenda-booking";
import { encontrarServicoAtivo } from "@/lib/servicos";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const data = searchParams.get("data");
  const servicoId = searchParams.get("servico_id");
  const servicoCodigo = searchParams.get("servico_codigo");
  const barbeiroIdParam = searchParams.get("barbeiro_id");
  const barbeiroId = barbeiroIdParam === "qualquer" ? null : barbeiroIdParam;

  if (!data) {
    return NextResponse.json({ erro: "Informe ?data=YYYY-MM-DD" }, { status: 400 });
  }

  if (!servicoId && !servicoCodigo) {
    return NextResponse.json({ erro: "Informe o servico." }, { status: 400 });
  }

  const servico = await encontrarServicoAtivo({ id: servicoId, codigo: servicoCodigo });
  if (!servico) {
    return NextResponse.json({ erro: "Servico nao encontrado ou inativo" }, { status: 404 });
  }

  const disponibilidade = await getAvailableSlots({
    data,
    duracao: Number(servico.duracao_minutos),
    barbeiroId,
  });

  return NextResponse.json({
    data,
    servico,
    horarios: disponibilidade.horarios,
    horarios_completos: disponibilidade.horarios_completos,
  });
}
