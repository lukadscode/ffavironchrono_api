# Solutions de Mailing - Recommandations

## 📧 Solutions recommandées

### 1. **Resend** ⭐ (Recommandé)
**Avantages** :
- ✅ API moderne et simple
- ✅ Excellent délivrabilité
- ✅ Gratuit jusqu'à 3 000 emails/mois
- ✅ Support HTML et templates React
- ✅ Webhooks pour le suivi
- ✅ Documentation excellente
- ✅ Pas de configuration SMTP complexe

**Prix** : Gratuit jusqu'à 3 000 emails/mois, puis $20/mois pour 50 000 emails

**Installation** :
```bash
npm install resend
```

### 2. **SendGrid** (Twilio)
**Avantages** :
- ✅ Très populaire et fiable
- ✅ Gratuit jusqu'à 100 emails/jour
- ✅ Templates avancés
- ✅ Analytics détaillées
- ✅ API REST simple

**Prix** : Gratuit jusqu'à 100 emails/jour, puis à partir de $19.95/mois

### 3. **Mailgun**
**Avantages** :
- ✅ Excellent pour les développeurs
- ✅ Gratuit jusqu'à 5 000 emails/mois (3 premiers mois)
- ✅ API puissante
- ✅ Webhooks et analytics

**Prix** : Gratuit 3 mois, puis à partir de $35/mois

### 4. **Postmark**
**Avantages** :
- ✅ Spécialisé dans les emails transactionnels
- ✅ Délivrabilité exceptionnelle
- ✅ Pas de plan gratuit mais très fiable

**Prix** : À partir de $15/mois pour 10 000 emails

### 5. **Amazon SES**
**Avantages** :
- ✅ Très économique à grande échelle
- ✅ Intégration AWS
- ✅ Pay-as-you-go

**Prix** : $0.10 pour 1 000 emails

---

## 🚀 Implémentation recommandée : Resend

Resend est la meilleure option pour votre cas d'usage car :
- Simple à intégrer
- Gratuit pour commencer
- Excellent pour les emails transactionnels (vérification, mots de passe, etc.)
- Support HTML moderne
- Pas besoin de configuration SMTP

---

## 📦 Installation et Configuration

### 1. Installer Resend

```bash
npm install resend
```

### 2. Configuration dans `.env`

Ajoutez ces variables à votre fichier `.env` :

```env
# Resend (recommandé)
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@votredomaine.com
USE_RESEND=true

# OU SMTP (fallback)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-app
SMTP_FROM=noreply@votredomaine.com
```

### 3. Obtenir une clé API Resend

1. Créez un compte sur [resend.com](https://resend.com)
2. Vérifiez votre domaine (ou utilisez le domaine de test)
3. Créez une clé API dans le dashboard
4. Ajoutez `RESEND_API_KEY` dans votre `.env`

### 4. Vérifier votre domaine (optionnel mais recommandé)

Pour envoyer depuis votre propre domaine :
1. Ajoutez votre domaine dans Resend
2. Ajoutez les enregistrements DNS fournis
3. Utilisez `RESEND_FROM_EMAIL=noreply@votredomaine.com`

---

## 🔄 Migration depuis SMTP

Le code a été modifié pour supporter **automatiquement** Resend si la clé API est présente, avec fallback vers SMTP.

**Aucun changement de code nécessaire** dans vos contrôleurs ! Le module `sendEmail` gère automatiquement :
- ✅ Resend si `RESEND_API_KEY` est défini
- ✅ SMTP en fallback si Resend n'est pas disponible

---

## 📝 Exemple d'utilisation

Le code existant fonctionne sans modification :

```javascript
const sendEmail = require("../utils/sendEmail");

await sendEmail(
  "user@example.com",
  "Vérification de votre adresse",
  "Cliquez pour vérifier : https://aviron-app.com/verify-email?token=xxx"
);
```

**Avec HTML** (optionnel) :
```javascript
await sendEmail(
  "user@example.com",
  "Vérification de votre adresse",
  "Texte brut",
  "<h1>Vérification</h1><p>Cliquez <a href='...'>ici</a></p>"
);
```

---

## 🎨 Templates HTML (optionnel)

Resend supporte les templates React. Vous pouvez créer un fichier séparé pour les templates :

```javascript
// src/utils/emailTemplates.js
exports.verificationEmail = (token) => ({
  subject: "Vérification de votre adresse",
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>Bienvenue !</h1>
      <p>Cliquez sur le lien suivant pour vérifier votre email :</p>
      <a href="https://aviron-app.com/verify-email?token=${token}" 
         style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
        Vérifier mon email
      </a>
    </div>
  `,
  text: `Vérifiez votre email : https://aviron-app.com/verify-email?token=${token}`
});
```

---

## 🔍 Comparaison rapide

| Critère | Resend | SendGrid | Mailgun | SMTP |
|---------|--------|---------|---------|------|
| **Facilité** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Gratuit** | 3K/mois | 100/jour | 5K/mois (3 mois) | Dépend |
| **Délivrabilité** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Setup** | 2 min | 5 min | 5 min | 15 min |
| **API Moderne** | ✅ | ✅ | ✅ | ❌ |

---

## ✅ Avantages de Resend

1. **Pas de configuration SMTP** : Juste une clé API
2. **Meilleure délivrabilité** : Infrastructure optimisée
3. **Gratuit généreux** : 3 000 emails/mois
4. **Templates React** : Pour des emails modernes
5. **Webhooks** : Suivi des événements (livré, ouvert, cliqué)
6. **Analytics** : Dashboard avec statistiques

---

## 🚨 Note importante

Le code actuel **fonctionne déjà** avec Resend ! Il suffit d'ajouter `RESEND_API_KEY` dans votre `.env` et Resend sera utilisé automatiquement. Le SMTP reste disponible en fallback si besoin.

