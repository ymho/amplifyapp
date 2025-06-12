// i18n.js
import { I18n } from 'aws-amplify/utils';

const dict = {
  ja: {
    // サインイン画面
    'Username': 'ユーザー名',
    'Password': 'パスワード',
    'Email': 'メールアドレス',
    'Enter your Email': 'メールアドレスを入力してください',
    'Enter your Username': 'ユーザー名を入力してください',
    'Enter your Password': 'パスワードを入力してください',
    'Confirm Password': 'パスワードを確認',
    'Please confirm your Password': 'パスワードを再入力してください',
    'Reset Password': 'パスワードのリセット',
    'Enter your username': '名前（ID）を入力してください',
    'Sign In': 'サインイン',
    'Sign in': 'サインイン',
    'Sign Up': 'サインアップ',
    'Forgot your password?': 'パスワードをお忘れの方',
    'Reset password': 'パスワードをリセット',
    'No account?': 'アカウントを持っていない方',
    'Create account': 'アカウントを作成',
    'Create Account': 'アカウントを作成',
    'Have an account?': 'アカウントお持ちの方',
    'Confirm Sign up': 'サインアップの確認',
    'Back to Sign In': 'サインインに戻る',
    'Send code': 'コードを送信',
    'We Emailed You': 'メールを送信しました',
    'Your code is on the way. To log in, enter the code we emailed to': 'ログインするには',
    'It may take a minute to arrive': 'に送信したコードを入力してください',
    'Setup TOTP': '二要素認証の設定',
    'Code *': 'Microsoft Authenticatorをお使いください *',
    'Confirm': '確認',
    'Confirm TOTP Code': '二要素認証コードの入力',
    'Your software token has already been used once': 'ソフトウェアトークンはすでに使用済みです。新しいトークンを生成してください。',
    'Invalid code received for user': 'ユーザーに対して無効なコードが受信されました',
    'Given Name': '名',
    'Family Name': '姓',
    'Enter your Given Name': '太郎',
    'Enter your Family Name': '西日本',
    'Your passwords must match': 'パスワードが一致しません',
    'Password must have at least 8 characters': 'パスワードは8文字以上である必要があります',
    // 必要に応じて他のラベルも追加
  }
};

I18n.putVocabularies(dict);
I18n.setLanguage('ja');

