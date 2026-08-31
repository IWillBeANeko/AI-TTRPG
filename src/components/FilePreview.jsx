import React from 'react';
import { 
  FileText, 
  Image, 
  Code, 
  X, 
  File, 
  Download,
  FileCode,
  FileImage
} from 'lucide-react';

const FilePreview = ({ files, onRemoveFile }) => {
  const getFileIcon = (file) => {
    if (file.type.includes('image')) {
      return FileImage;
    } else if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
      return FileText;
    } else if (file.name.endsWith('.js') || file.name.endsWith('.css')) {
      return FileCode;
    }
    return File;
  };

  const getFilePreview = (file) => {
    if (file.type.includes('image')) {
      return (
        <img 
          src={file.url} 
          alt={file.name}
          className="w-full h-24 object-cover rounded-lg mx-auto"
        />
      );
    }
    return (
      <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center">
        <FileText className="h-8 w-8 text-gray-400" />
      </div>
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileType = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    const types = {
      'html': 'HTML',
      'htm': 'HTML',
      'css': 'CSS',
      'js': 'JavaScript',
      'json': 'JSON',
      'xml': 'XML',
      'jpg': 'JPEG',
      'jpeg': 'JPEG',
      'png': 'PNG',
      'gif': 'GIF',
      'svg': 'SVG',
      'ico': 'ICO'
    };
    return types[ext] || 'Unknown';
  };

  if (files.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          文件预览
        </h3>
        <div className="text-center py-12">
          <File className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">暂无文件</p>
          <p className="text-sm text-gray-400">
            上传文件后将在此处显示预览
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          文件预览
        </h3>
        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {files.length} 个文件
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
        {files.map((file) => {
          const FileIcon = getFileIcon(file);
          return (
            <div
              key={file.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileIcon className="h-5 w-5 text-blue-500" />
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {getFileType(file)}
                  </span>
                </div>
                <button
                  onClick={() => onRemoveFile(file.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {getFilePreview(file)}

              <div className="mt-3">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatFileSize(file.size)}
                </p>
              </div>

              {file.type.includes('image') && (
                <button
                  onClick={() => window.open(file.url, '_blank')}
                  className="mt-2 w-full text-xs bg-blue-50 text-blue-600 py-1 px-2 rounded hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                >
                  <Download className="h-3 w-3" />
                  查看原图
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            总文件大小: {formatFileSize(files.reduce((acc, file) => acc + file.size, 0))}
          </span>
          <button className="text-blue-600 hover:text-blue-700 font-medium">
            全部下载
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilePreview;
