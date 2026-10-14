import { createAccountGroup, deleteAccountGroup, updateAccountGroup, addAccountToGroup, removeAccountFromGroup } from '@/server/account-group-actions';
import { fail, type ActionResult } from '@/server/result';

/**
 * Rota para criar um novo grupo de contas.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createAccountGroup(body);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Erro ao criar grupo de contas:', error);
    return Response.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/**
 * Rota para atualizar um grupo de contas existente.
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const result = await updateAccountGroup(body);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Erro ao atualizar grupo de contas:', error);
    return Response.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/**
 * Rota para adicionar/remover contas ou apagar um grupo.
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    
    if (body.action === 'delete') {
      const result = await deleteAccountGroup(body);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      return Response.json({ success: true });
    } else if (body.action === 'addAccount') {
      const result = await addAccountToGroup(body);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      return Response.json({ success: true });
    } else if (body.action === 'removeAccount') {
      const result = await removeAccountFromGroup(body);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Ação não reconhecida' }, { status: 400 });
  } catch (error) {
    console.error('Erro ao manipular grupo de contas:', error);
    return Response.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
