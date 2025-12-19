# UniLink

[![Expo](https://img.shields.io/badge/Expo-52.0.33-black.svg)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.76.6-blue.svg)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-blue.svg)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-2.39.3-green.svg)](https://supabase.com/)

UniLink is a comprehensive mobile application designed to connect university students, streamline academic collaboration, and manage attendance tracking. Built with React Native and Expo, it provides a seamless experience across iOS, Android, and web platforms.

## 🚀 Features

### Core Functionality
- **User Authentication**: Secure login and registration with Supabase Auth
- **Profile Management**: Complete profile setup and editing capabilities
- **Academic Groups**: Create and join study groups with role-based access
- **Attendance Tracking**: Automated and manual attendance marking with detailed analytics
- **Assignment Management**: Create, distribute, and track assignments within groups
- **Material Sharing**: Upload and share class materials, documents, and resources
- **Real-time Chat**: Group messaging for academic discussions
- **Marks Management**: Record and view student grades and performance
- **Post System**: Community posts with comments and interactions

### Technical Features
- **Cross-Platform**: Native iOS, Android, and web support
- **Offline Support**: Core functionality works offline with sync capabilities
- **Real-time Updates**: Live data synchronization across devices
- **File Upload**: Support for images, documents, and multimedia content
- **Camera Integration**: Direct photo capture for attendance and materials
- **Push Notifications**: Stay updated with important announcements
- **Dark/Light Theme**: Automatic theme switching based on device settings

## 🛠️ Tech Stack

### Frontend
- **React Native 0.76.6**: Cross-platform mobile development
- **Expo 52.0.33**: Development platform and build service
- **TypeScript 5.3.3**: Type-safe JavaScript
- **Expo Router 4.0.17**: File-based routing for React Native

### Backend & Database
- **Supabase**: Open-source Firebase alternative
  - Authentication
  - Real-time database
  - File storage
  - Edge functions

### UI & UX
- **React Native Reanimated**: Smooth animations
- **Expo Vector Icons**: Icon library
- **Lucide React Native**: Additional icon set
- **Expo Linear Gradient**: Gradient backgrounds
- **Expo Blur**: Blur effects

### Development Tools
- **ESLint**: Code linting
- **Babel**: JavaScript transpilation
- **Metro**: JavaScript bundler for React Native

## 📋 Prerequisites

Before running this project, make sure you have the following installed:

- **Node.js** (version 18 or higher)
- **npm** or **yarn** package manager
- **Expo CLI**: `npm install -g @expo/cli`
- **Git**: For version control

### Platform-Specific Requirements

#### iOS Development
- macOS with Xcode 15+
- iOS Simulator or physical iOS device

#### Android Development
- Android Studio with Android SDK
- Android emulator or physical Android device

#### Web Development
- Modern web browser (Chrome, Firefox, Safari, Edge)

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/unilink.git
   cd unilink
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Setup**
   
   Copy the `.env.example` file to `.env` and update it with your Supabase configuration:
   ```bash
   cp .env.example .env
   ```
   
   Then edit the `.env` file with your actual values:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
   
   **Security Note**: Never commit the `.env` file to version control. It contains sensitive API keys.

## ⚙️ Supabase Setup

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com) and create a new project
   - Wait for the project to be fully initialized

2. **Database Configuration**
   - Run the SQL migrations in the `supabase/migrations/` directory in order
   - Set up Row Level Security (RLS) policies for your tables

3. **Storage Setup**
   - Create storage buckets for:
     - `profile-images`: User profile pictures
     - `class-materials`: Academic materials and documents
     - `assignment-files`: Assignment submissions

4. **Authentication Configuration**
   - Configure authentication providers (Email, Google, etc.)
   - Set up email templates for verification and password reset

## 🏃‍♂️ Running the Application

### Development Mode
```bash
npm run dev
# or
yarn dev
```

This will start the Expo development server. You can then:
- Press `i` to open iOS simulator
- Press `a` to open Android emulator
- Press `w` to open web browser
- Scan QR code with Expo Go app on physical device

### Production Build

#### For iOS
```bash
npx expo build:ios
```

#### For Android
```bash
npx expo build:android
```

#### For Web
```bash
npm run build:web
npx serve dist
```

## 📁 Project Structure

```
unilink/
├── app/                    # Main application code (Expo Router)
│   ├── (tabs)/            # Tab-based navigation
│   ├── academic/          # Academic group management
│   ├── attendance/        # Attendance tracking
│   ├── auth/              # Authentication screens
│   ├── post/              # Social posts
│   └── profile/           # User profiles
├── assets/                # Static assets
│   └── images/            # App icons and images
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
│   └── supabase.ts        # Supabase client configuration
├── supabase/              # Database migrations and queries
│   └── migrations/        # SQL migration files
├── types/                 # TypeScript type definitions
├── app.json               # Expo configuration
├── package.json           # Dependencies and scripts
└── tsconfig.json          # TypeScript configuration
```

## 🔧 Development Scripts

- `npm run dev` - Start development server
- `npm run build:web` - Build for web deployment
- `npm run lint` - Run ESLint for code quality

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

### Code Style
- Use TypeScript for all new code
- Follow the existing code style and naming conventions
- Run `npm run lint` before committing
- Add tests for new features

## 📝 API Documentation

The application uses Supabase as its backend. Key API endpoints include:

- **Authentication**: User login, registration, and session management
- **Groups**: CRUD operations for academic groups
- **Attendance**: Session creation, marking, and reporting
- **Materials**: File upload and management
- **Chat**: Real-time messaging within groups

For detailed API documentation, refer to the Supabase dashboard or the SQL files in `supabase/`.

## 🐛 Troubleshooting

### Common Issues

1. **Metro bundler issues**
   ```bash
   npx expo install --fix
   ```

2. **Clear cache**
   ```bash
   npx expo start --clear
   ```

3. **iOS build issues**
   - Ensure Xcode is up to date
   - Clean build folder in Xcode

4. **Android build issues**
   - Ensure Android SDK is properly configured
   - Check Android emulator settings

### Environment Variables
Make sure all required environment variables are set in your `.env` file. Missing variables will cause authentication and database connection errors.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **ATUL PARMAR** - *Initial work* - [GitHub](https://github.com/Atulx21)

## 🙏 Acknowledgments

- Expo team for the amazing development platform
- Supabase team for the powerful backend-as-a-service
- React Native community for the excellent framework
- All contributors and users of UniLink

## 📞 Support

If you have any questions or need help:

- Open an issue on GitHub
- Check the [Expo documentation](https://docs.expo.dev/)
- Visit the [Supabase documentation](https://supabase.com/docs)

---

**Happy coding with UniLink! 🎓📱**