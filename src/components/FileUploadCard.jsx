import React, { useRef } from 'react';
import { Upload, File, Plus } from 'lucide-react';

const FileUploadCard = ({ onFileUpload }) => {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      onFileUpload(files);
      e.target.value = ''; // 重置输入
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFileUpload(files);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        上传文件
      </h3>
      
      <div 
        className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <Upload className="h-12 w-12 text-blue-500 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-700 mb-2">
          点击或拖拽文件到此处
        </p>
        <p className="text-sm text-gray-500">
          支持 HTML、CSS、JS、图片文件
        </p>
      </div>

      <button
        onClick={openFileDialog}
        className="mt-4 w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="h-5 w-5" />
        选择文件
      </button>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".html,.css,.js,.jpg,.jpeg,.png,.gif,.svg,.ico,.json,.xml"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default FileUploadCard;
