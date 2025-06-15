import {
  MdPictureAsPdf,
  MdImage,
  MdMovie,
  MdAudiotrack,
  MdDescription,
  MdInsertDriveFile,
  MdTableChart,
  MdSlideshow,
  MdArchive,
} from "react-icons/md";

export const getFileIcon = (fileName) => {
  const ext = fileName.split(".").pop().toLowerCase();
  if (!ext) return <MdInsertDriveFile />;

  switch (ext) {
    case "pdf":
      return <MdPictureAsPdf />;
    case "doc":
    case "docx":
    case "txt":
    case "rtf":
      return <MdDescription />;
    case "xls":
    case "xlsx":
    case "csv":
      return <MdTableChart />;
    case "ppt":
    case "pptx":
      return <MdSlideshow />;
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "bmp":
    case "webp":
      return <MdImage />;
    case "mp4":
    case "mov":
    case "avi":
    case "webm":
    case "wmv":
    case "mkv":
      return <MdMovie />;
    case "mp3":
    case "wav":
    case "ogg":
    case "m4a":
      return <MdAudiotrack />;
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
      return <MdArchive />;
    default:
      return <MdInsertDriveFile />;
  }
};
