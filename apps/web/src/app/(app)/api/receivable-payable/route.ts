import { createReceivablePayable, deleteReceivablePayable, payReceivablePayable, updateReceivablePayable, updateReceivablePayableStatus } from '@/server/receivable-payable-actions';
import { fail, type ActionResult } from '@/server/result';

/**
 * Rota para criar uma nova conta a pagar/receber.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createReceivablePayable(body);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Erro ao criar conta a pagar/receber:', error);
    return Response.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/**
 * Rota para atualizar uma conta a pagar/receber existente.
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const result = await updateReceivablePayable(body);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Erro ao atualizar conta a pagar/receber:', error);
    return Response.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/**
 * Rota para registrar o pagamento de uma conta a pagar/receber.
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const result = await payReceivablePayable(body);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Erro ao registrar pagamento:', error);
    return Response.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/**
 * Rota para apagar ou atualizar status de uma conta a pagar/receber.
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    
    if (body.action === 'delete') {
      const result = await deleteReceivablePayable(body);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      return Response.json({ success: true });
    } else if (body.action === 'status') {
      const result = await updateReceivablePayableStatus(body);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Ação não reconhecida' }, { status: 400 });
  } catch (error) {
    console.error('Erro ao apagar conta a pagar/receber:', error);
    return Response.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
