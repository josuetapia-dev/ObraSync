<?php

namespace App\Policies;

use App\Enums\Rol;
use App\Models\Obra;
use App\Models\User;

/** Quién puede ver una obra: el admin todas; los demás, solo las asignadas. */
class ObraPolicy
{
    public function view(User $user, Obra $obra): bool
    {
        if ($user->tieneRol(Rol::Admin)) {
            return true;
        }

        return $obra->usuarios()->whereKey($user->id)->exists();
    }
}
