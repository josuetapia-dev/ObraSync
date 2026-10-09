<?php

namespace App\Policies;

use App\Enums\Rol;
use App\Models\Bitacora;
use App\Models\User;

/** Editar o borrar una entrada: su autor, o el mayordomo/admin de esa obra. */
class BitacoraPolicy
{
    public function update(User $user, Bitacora $bitacora): bool
    {
        if ($bitacora->user_id === $user->id) {
            return true;
        }

        return $user->tieneRol(Rol::Mayordomo, Rol::Admin) && $user->can('view', $bitacora->obra);
    }
}
