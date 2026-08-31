import React from 'react';
import { 
  Folder, 
  Upload, 
  Settings, 
  Globe, 
  CheckCircle,
  Code,
  ExternalLink
} from 'lucide-react';

const DeploymentSteps = ({ activeStep, setActiveStep }) => {
  const steps = [
    {
      id: 0,
      title: '准备文件',
      description: '整理您的 HTML、CSS、JavaScript 文件',
      icon: Folder,
      details: '确保您的项目结构清晰，包含必要的依赖文件。'
    },
    {
      id: 1,
      title: '上传文件',
      description: '将文件上传到 NoCode 平台',
      icon: Upload,
      details: '支持拖拽上传或点击选择文件。'
    },
    {
      id: 2,
      title: '配置设置',
      description: '设置域名和部署选项',
      icon: Settings,
      details: '配置自定义域名、SSL证书等选项。'
    },
    {
      id: 3,
      title: '部署上线',
      description: '一键部署到互联网',
      icon: Globe,
      details: '点击部署按钮，等待几秒钟即可完成。'
    }
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-6">
        部署步骤
      </h3>
      
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              activeStep === step.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setActiveStep(step.id)}
          >
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-full ${
                activeStep === step.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                <step.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800 mb-1">
                  步骤 {step.id + 1}: {step.title}
                </h4>
                <p className="text-sm text-gray-600 mb-2">
                  {step.description}
                </p>
                {activeStep === step.id && (
                  <p className="text-sm text-blue-600">
                    {step.details}
                  </p>
                )}
              </div>
              {activeStep === step.id && (
                <CheckCircle className="h-5 w-5 text-blue-500" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-800 mb-2">
          快速开始
        </h4>
        <p className="text-sm text-blue-700 mb-3">
          访问 NoCode 平台开始部署：
        </p>
        <a
          href="https://nocode.host"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          前往 NoCode.host
        </a>
      </div>
    </div>
  );
};

export default DeploymentSteps;
