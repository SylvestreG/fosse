# 🌊 Fosse - Gestionnaire de sessions de plongée

Application web pour gérer les sessions, participants et questionnaires d'un club de plongée.

## 🚀 Stack technique

- **Backend**: Rust + Actix-web
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Base de données**: PostgreSQL
- **Authentification**: Google OAuth 2.0 + JWT

## 📦 Installation

### Prérequis

- Rust 1.70+
- Node.js 20+
- PostgreSQL 15+
- Docker & Docker Compose (recommandé)

### Configuration

1. **Cloner le repository**
```bash
git clone https://github.com/SylvestreG/fosse.git
cd fosse
```

2. **Démarrer la base de données**
```bash
docker-compose up -d
```

3. **Configurer l'application**
```bash
cp config.example.json config.json
```

Éditez `config.json` et configurez :
- **Google OAuth** : Créez un projet dans [Google Cloud Console](https://console.cloud.google.com)
  - Activez l'API Google OAuth
  - Créez des credentials OAuth 2.0
  - Ajoutez `http://localhost:8080/api/v1/auth/google/callback` comme URI de redirection
- **JWT Secret** : Générez une clé forte avec `openssl rand -base64 64`
- **Admin emails** : Liste des emails autorisés comme administrateurs
- **Database URL** : Connection string PostgreSQL
- **Magic Link Base URL** : URL de base pour les liens magiques (généralement `http://localhost:8080` en dev)

4. **Installer les dépendances**
```bash
make install
```

5. **Lancer l'application**
```bash
make dev
```

L'application sera accessible sur **http://localhost:8080**

## 🎯 Commandes disponibles

```bash
make help          # Afficher toutes les commandes
make install       # Installer les dépendances
make dev           # Mode développement (recommandé)
make build         # Build production
make test          # Lancer les tests
make clean         # Nettoyer les artefacts
```

## 🧪 Tests

```bash
cd backend
cargo test
```

## 🔒 Sécurité

⚠️ **Important** : Ne commitez JAMAIS le fichier `config.json` qui contient vos secrets.

- Utilisez `config.example.json` comme template
- Générez un JWT secret fort pour la production
- Configurez Google OAuth avec des credentials uniques
- Utilisez HTTPS en production

## 📝 Structure du projet

```
fosse/
├── backend/          # API Rust
│   ├── src/
│   │   ├── handlers/ # Route handlers
│   │   ├── models/   # Data models
│   │   ├── services/ # Business logic
│   │   └── entities/ # Database entities
│   └── migration/    # Database migrations
├── frontend/         # React app
│   └── src/
│       ├── components/
│       ├── pages/
│       └── lib/
└── config.json       # Configuration (git-ignored)
```

## 🤝 Contribution

Les contributions sont bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## 📄 Licence

MIT

## 👤 Auteur

Développé pour la gestion des sessions de plongée.

