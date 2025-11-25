# Améliorations de l'import d'événements

## Problème identifié
Erreur 500 lors de l'import d'événements avec beaucoup de participants. L'import peut être très long et provoquer des timeouts.

## Améliorations apportées

### 1. Gestion d'erreurs améliorée

**Controller (`src/controllers/importController.js`)** :
- Ajout de logs détaillés avec durée d'exécution
- Messages d'erreur plus informatifs
- Logs de stack trace en mode développement
- Retour des détails de l'erreur (durée, event_id si créé)

**Service (`src/services/importManifestation.js`)** :
- Try-catch autour de chaque création de participant
- Try-catch autour de chaque création d'équipage
- Continue avec les éléments suivants en cas d'erreur (ne bloque pas tout l'import)
- Logs de progression tous les 50 équipages

### 2. Optimisation des performances

**Fonction `findOrCreateParticipant()`** :
- Optimisation de la recherche de participants existants
- Remplacement des requêtes complexes avec includes par des requêtes simples
- Limitation à 10 candidats pour éviter les requêtes trop lourdes

**Logs de progression** :
- Affichage de la progression tous les 50 équipages
- Permet de suivre l'avancement de l'import

### 3. Timeouts augmentés

**Express (`src/app.js`)** :
- Timeout HTTP augmenté à 5 minutes (300000ms)
- Limite de taille des requêtes augmentée à 50mb

**API externe** :
- Timeout de 60 secondes pour les appels à l'API externe

## Comment diagnostiquer une erreur

### 1. Vérifier les logs serveur

Les logs affichent maintenant :
- La durée totale de l'import
- Le nombre d'équipages traités
- Les erreurs spécifiques avec le contexte
- La progression tous les 50 équipages

Exemple de logs :
```
🚀 Début de l'import de la manifestation 410...
📥 Récupération de la manifestation 410...
✅ Manifestation récupérée: Championnat Indoor
📊 25 épreuves, 150 inscriptions
📊 1200 participants trouvés dans l'API externe
📅 Création de l'événement...
✅ Événement créé: abc-123-def
📏 Création des distances...
  ✅ Distance créée: 2000m
  ✅ Relais créé: 8x250m
...
👥 Création des équipages et participants...
  📊 Progression: 50/150 inscriptions traitées (50 équipages créés)
  📊 Progression: 100/150 inscriptions traitées (100 équipages créés)
  📊 Progression: 150/150 inscriptions traitées (150 équipages créés)
✅ 150 équipages créés
✅ 200 nouveaux participants créés
✅ 1200 participants totaux liés aux équipages
✅ Import terminé avec succès en 45.32s
```

### 2. Vérifier la réponse d'erreur

En cas d'erreur, la réponse contient maintenant :
```json
{
  "status": "error",
  "message": "Description de l'erreur",
  "details": {
    "message": "Description détaillée",
    "stack": "Stack trace (en développement)",
    "duration": "45.32s",
    "event_id": "abc-123-def" // Si l'événement a été créé
  }
}
```

### 3. Erreurs courantes et solutions

**Timeout HTTP** :
- Le timeout est maintenant de 5 minutes
- Si l'import prend plus de temps, envisager de le rendre asynchrone

**Erreur de création de participant** :
- Les erreurs sont loggées mais n'arrêtent pas l'import
- Vérifier les logs pour voir quels participants ont échoué

**Erreur de création d'équipage** :
- Les erreurs sont loggées mais n'arrêtent pas l'import
- Vérifier les logs pour voir quels équipages ont échoué

**Erreur de connexion à l'API externe** :
- Vérifier que `EXTERNAL_API_TOKEN` est correct
- Vérifier la connexion réseau

## Prochaines améliorations possibles

1. **Import asynchrone** : Utiliser un système de jobs (Bull, Agenda.js) pour les imports très longs
2. **Transactions** : Utiliser des transactions DB pour garantir la cohérence
3. **Batch inserts** : Utiliser des insertions par lots pour améliorer les performances
4. **WebSocket** : Envoyer la progression en temps réel au front via WebSocket

## Vérification

Pour vérifier que l'import fonctionne :

1. Vérifier les logs serveur pour voir où ça bloque
2. Vérifier la réponse HTTP pour les détails de l'erreur
3. Vérifier dans la base de données si des données partielles ont été créées
4. Relancer l'import si nécessaire (les doublons sont évités)


