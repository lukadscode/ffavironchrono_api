# Changement du système de statuts des équipages (Crew Status)

## 📋 Résumé

Le champ `status` de la table `crews` a été modifié pour passer d'un **INTEGER** à un **ENUM (STRING)** avec des valeurs sémantiques claires pour gérer les forfaits, abandons, disqualifications, etc.

## 🔄 Changements techniques

### Avant
```typescript
// Type : INTEGER
// Valeur par défaut : 8
// Valeurs possibles : nombres (non documentées)
```

### Après
```typescript
// Type : STRING (ENUM)
// Valeur par défaut : "registered"
// Valeurs possibles : voir ci-dessous
```

## 📝 Valeurs possibles du statut

| Valeur | Code | Description | Usage |
|--------|------|-------------|-------|
| `registered` | ✅ | Inscrit (par défaut) | Équipage normal, inscrit et prêt à participer |
| `dns` | ⚠️ | Did Not Start | Forfait : n'a pas pris le départ |
| `dnf` | ⚠️ | Did Not Finish | Abandon : a commencé mais n'a pas terminé |
| `disqualified` | ❌ | Disqualifié | Équipage disqualifié |
| `changed` | 🔄 | Changement d'équipage | L'équipage a été modifié (changement de participants) |
| `withdrawn` | 🚫 | Retiré | Équipage retiré de la compétition |
| `scratch` | 🚫 | Scratch | Retiré avant le départ de la course |

## 🎯 Impact sur l'API

### Endpoints concernés

1. **GET /crews** - Liste des équipages
   - Le champ `status` retourne maintenant une string au lieu d'un nombre

2. **GET /crews/:id** - Détail d'un équipage
   - Même changement

3. **POST /crews** - Créer un équipage
   - Le champ `status` accepte maintenant une string parmi les valeurs valides
   - Si non fourni, valeur par défaut : `"registered"`

4. **PUT /crews/:id** - Modifier un équipage
   - Le champ `status` accepte maintenant une string parmi les valeurs valides

### Exemple de réponse API

**Avant :**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "event_id": "uuid",
    "category_id": "uuid",
    "status": 8,
    "club_name": "MEAUX CNM",
    "club_code": "C077002"
  }
}
```

**Après :**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "event_id": "uuid",
    "category_id": "uuid",
    "status": "registered",
    "club_name": "MEAUX CNM",
    "club_code": "C077002"
  }
}
```

### Exemple de requête (POST/PUT)

```json
{
  "event_id": "uuid",
  "category_id": "uuid",
  "status": "dns",
  "club_name": "MEAUX CNM",
  "club_code": "C077002"
}
```

## 💻 Implémentation frontend recommandée

### 1. Créer des constantes TypeScript/JavaScript

```typescript
// constants/crewStatus.ts
export enum CrewStatus {
  REGISTERED = "registered",
  DNS = "dns",
  DNF = "dnf",
  DISQUALIFIED = "disqualified",
  CHANGED = "changed",
  WITHDRAWN = "withdrawn",
  SCRATCH = "scratch",
}

export const CREW_STATUS_LABELS: Record<CrewStatus, string> = {
  [CrewStatus.REGISTERED]: "Inscrit",
  [CrewStatus.DNS]: "DNS (N'a pas pris le départ)",
  [CrewStatus.DNF]: "DNF (N'a pas terminé)",
  [CrewStatus.DISQUALIFIED]: "Disqualifié",
  [CrewStatus.CHANGED]: "Changement d'équipage",
  [CrewStatus.WITHDRAWN]: "Retiré",
  [CrewStatus.SCRATCH]: "Scratch",
};

// Statuts qui empêchent la participation
export const NON_PARTICIPATING_STATUSES = [
  CrewStatus.DNS,
  CrewStatus.WITHDRAWN,
  CrewStatus.SCRATCH,
];

// Statuts qui indiquent une participation incomplète
export const INCOMPLETE_STATUSES = [
  CrewStatus.DNF,
  CrewStatus.DISQUALIFIED,
];
```

### 2. Mettre à jour les types/interfaces

```typescript
// types/crew.ts
export interface Crew {
  id: string;
  event_id: string;
  category_id: string;
  status: CrewStatus; // Au lieu de number
  club_name?: string;
  club_code?: string;
  coach_name?: string;
}
```

### 3. Créer un composant d'affichage du statut

```tsx
// components/CrewStatusBadge.tsx
import { CrewStatus, CREW_STATUS_LABELS } from '@/constants/crewStatus';

interface CrewStatusBadgeProps {
  status: CrewStatus;
}

export const CrewStatusBadge: React.FC<CrewStatusBadgeProps> = ({ status }) => {
  const getStatusColor = (status: CrewStatus) => {
    switch (status) {
      case CrewStatus.REGISTERED:
        return 'bg-green-100 text-green-800';
      case CrewStatus.DNS:
      case CrewStatus.SCRATCH:
      case CrewStatus.WITHDRAWN:
        return 'bg-gray-100 text-gray-800';
      case CrewStatus.DNF:
        return 'bg-orange-100 text-orange-800';
      case CrewStatus.DISQUALIFIED:
        return 'bg-red-100 text-red-800';
      case CrewStatus.CHANGED:
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(status)}`}>
      {CREW_STATUS_LABELS[status]}
    </span>
  );
};
```

### 4. Filtrer les équipages selon le statut

```typescript
// utils/crewFilters.ts
import { Crew, CrewStatus, NON_PARTICIPATING_STATUSES } from '@/types/crew';

export const filterParticipatingCrews = (crews: Crew[]): Crew[] => {
  return crews.filter(
    crew => !NON_PARTICIPATING_STATUSES.includes(crew.status as CrewStatus)
  );
};

export const hasNonParticipatingStatus = (crew: Crew): boolean => {
  return NON_PARTICIPATING_STATUSES.includes(crew.status as CrewStatus);
};
```

### 5. Gérer l'affichage des résultats

```typescript
// utils/raceResults.ts
import { Crew, CrewStatus } from '@/types/crew';

export const formatCrewTime = (crew: Crew, time?: number): string => {
  if (crew.status === CrewStatus.DNS || crew.status === CrewStatus.SCRATCH) {
    return 'DNS';
  }
  if (crew.status === CrewStatus.DNF) {
    return 'DNF';
  }
  if (crew.status === CrewStatus.DISQUALIFIED) {
    return 'DSQ';
  }
  if (time) {
    return formatTime(time);
  }
  return '-';
};
```

## ⚠️ Points d'attention

### Migration des données existantes

Si vous avez des équipages existants avec `status: 8`, ils seront automatiquement convertis en `status: "registered"` par le backend.

### Validation côté frontend

Assurez-vous de valider que le statut envoyé est bien une des valeurs valides :

```typescript
const isValidStatus = (status: string): status is CrewStatus => {
  return Object.values(CrewStatus).includes(status as CrewStatus);
};
```

### Gestion des erreurs

Si le backend retourne une erreur de validation (statut invalide), afficher un message clair à l'utilisateur.

## 📚 Exemples d'utilisation

### Marquer un équipage en forfait

```typescript
// Marquer un équipage comme DNS (forfait)
await updateCrew(crewId, {
  status: CrewStatus.DNS,
});
```

### Filtrer les équipages participants

```typescript
// Afficher uniquement les équipages qui participent
const participatingCrews = crews.filter(
  crew => crew.status === CrewStatus.REGISTERED
);
```

### Afficher le statut dans un tableau

```tsx
<table>
  {crews.map(crew => (
    <tr key={crew.id}>
      <td>{crew.club_name}</td>
      <td>
        <CrewStatusBadge status={crew.status} />
      </td>
      <td>
        {hasNonParticipatingStatus(crew) ? (
          <span className="text-gray-400">-</span>
        ) : (
          formatTime(crew.time)
        )}
      </td>
    </tr>
  ))}
</table>
```

## 🔗 Références

- **Fichier de constantes backend** : `src/constants/crewStatus.js`
- **Modèle Crew** : `src/models/Crew.js`
- **Schéma de validation** : `src/schemas/crewSchema.js`
- **Documentation API** : `src/docs/crew.yaml`

## ✅ Checklist de migration frontend

- [ ] Créer les constantes TypeScript/JavaScript pour les statuts
- [ ] Mettre à jour les types/interfaces (status: number → status: string)
- [ ] Créer un composant d'affichage du statut (badge, etc.)
- [ ] Mettre à jour les formulaires de création/édition d'équipage
- [ ] Adapter les filtres et tris pour utiliser les nouveaux statuts
- [ ] Mettre à jour l'affichage des résultats (gérer DNS, DNF, DSQ)
- [ ] Tester avec les différentes valeurs de statut
- [ ] Mettre à jour la documentation frontend si nécessaire

---

**Date de mise en production** : À définir  
**Version API** : Actuelle  
**Contact** : Équipe backend

