import {
  getCurrentUser,
  fetchUserAttributes,
  fetchAuthSession
} from 'aws-amplify/auth';

export const getCurrentUserInfo = async () => {
  try {
    // 現在ログインしているユーザーの基本情報を取得
    await getCurrentUser();
    const attributes = await fetchUserAttributes();

    // アクセストークンからグループ情報を取得
    const { accessToken } = (await fetchAuthSession()).tokens ?? {};
    const groups = accessToken?.payload?.['cognito:groups'] || [];

    return {
      email: attributes.email,
      name: attributes.name || '', // User Pool 設定によっては未設定の可能性あり
      groups: groups,
      family_name: attributes.family_name || '', // Cognito User Pool で設定されている場合
      given_name: attributes.given_name || '', // Cognito User Pool で設定されている場合
    };
  } catch (err) {
    console.error('ユーザー情報の取得に失敗:', err);
    return null;
  }
};
