Pod::Spec.new do |s|
  s.name           = 'ExpoMemory'
  s.version        = '0.1.0'
  s.summary        = 'Expo module for reading available device memory'
  s.description    = 'Native module exposing os_proc_available_memory on iOS'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
