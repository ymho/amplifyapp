// src/utils/uploadFilesToS3.js
import { uploadData } from "aws-amplify/storage";

export const uploadFilesToS3 = async (files, path) => {
  const uploaded = [];

  for (const file of files) {
    const key = `${path}/${Date.now()}_${file.name}`;

    await uploadData({
      path: key,
      data: file,
      options: {
        contentType: file.type,
      },
    }).result;

    uploaded.push({
      file_name: file.name,
      path: key,
      content_type: file.type,
    });
  }

  return uploaded;
};
