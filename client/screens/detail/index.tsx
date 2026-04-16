import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import {
  getQuestionnaire,
  getSuggestions,
  triggerAnalysis,
  getReport,
  Questionnaire,
  Suggestion,
  Report,
} from '@/utils/api';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const questionnaireId = parseInt(id || '0');

  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitContent, setSubmitContent] = useState('');
  const [submitName, setSubmitName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [qData, sData] = await Promise.all([
        getQuestionnaire(questionnaireId),
        getSuggestions(questionnaireId),
      ]);
      setQuestionnaire(qData);
      setSuggestions(sData);

      // Check if report exists
      if (qData.status === 'completed') {
        try {
          const rData = await getReport(questionnaireId);
          setReport(rData);
        } catch {
          // Report not available yet
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      Alert.alert('错误', '获取数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [questionnaireId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const isDeadlinePassed = () => {
    if (!questionnaire) return true;
    return new Date(questionnaire.deadline) < new Date();
  };

  const handleAnalyze = async () => {
    if (suggestions.length === 0) {
      Alert.alert('提示', '目前没有收集到任何意见，请稍后再试');
      return;
    }

    Alert.alert(
      '确认分析',
      `将分析 ${suggestions.length} 条收集到的意见，生成培训需求分析报告。是否继续？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '开始分析',
          onPress: async () => {
            setAnalyzing(true);
            try {
              const result = await triggerAnalysis(questionnaireId);
              setReport(result);
              if (questionnaire) {
                setQuestionnaire({ ...questionnaire, status: 'completed' });
              }
              Alert.alert('成功', '分析报告已生成');
            } catch (error: any) {
              console.error('Failed to analyze:', error);
              Alert.alert('错误', error.message || '分析失败');
            } finally {
              setAnalyzing(false);
            }
          },
        },
      ]
    );
  };

  const handleDownloadReport = async () => {
    if (!report?.word_download_url) {
      Alert.alert('提示', '报告文件不可用');
      return;
    }

    try {
      const downloadUrl = report.word_download_url;
      
      // 直接使用Web API下载
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const uri = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(blob);
      });

      if (await Sharing.isAvailableAsync()) {
        // 创建临时文件
        const base64Data = uri.split(',')[1];
        const tempUri = (FileSystem as any).cacheDirectory + `report_${Date.now()}.docx`;
        await (FileSystem as any).writeAsStringAsync(tempUri, base64Data, {
          encoding: (FileSystem as any).EncodingType.Base64,
        });
        
        await Sharing.shareAsync(tempUri, {
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          dialogTitle: '下载培训需求分析报告',
        });
      } else {
        Alert.alert('成功', '请使用浏览器下载报告');
      }
    } catch (error) {
      console.error('Failed to download:', error);
      Alert.alert('错误', '下载失败');
    }
  };

  const handleSubmitSuggestion = async () => {
    if (!submitContent.trim()) {
      Alert.alert('错误', '请输入您的意见');
      return;
    }

    setSubmitting(true);
    try {
      const result = await triggerAnalysis;
      await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/questionnaires/${questionnaireId}/suggestions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: submitContent.trim(),
            submitterName: submitName.trim() || '匿名用户',
          }),
        }
      ).then(async (response) => {
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || '提交失败');
        }
        return response.json();
      });

      Alert.alert('成功', '感谢您的反馈！');
      setShowSubmitModal(false);
      setSubmitContent('');
      setSubmitName('');
      fetchData();
    } catch (error: any) {
      console.error('Failed to submit:', error);
      Alert.alert('错误', error.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  if (loading || !questionnaire) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <LinearGradient
          colors={['#6C63FF', '#896BFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {questionnaire.title}
          </Text>
          <View style={styles.headerPlaceholder} />
        </LinearGradient>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#6C63FF']}
              tintColor="#6C63FF"
            />
          }
        >
          {/* QR Code Section */}
          <View style={styles.cardOuter}>
            <View style={styles.cardShadow}>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>扫码填写</Text>
                <View style={styles.qrContainer}>
                  {questionnaire.qr_code_url ? (
                    <Image
                      source={{ uri: questionnaire.qr_code_url }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.qrPlaceholder} />
                  )}
                </View>
                <Text style={styles.qrHint}>
                  请使用微信或其他扫码工具填写培训意见
                </Text>
              </View>
            </View>
          </View>

          {/* Info Section */}
          <View style={styles.cardOuter}>
            <View style={styles.cardShadow}>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>问卷信息</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>截止时间</Text>
                  <Text style={styles.infoValue}>
                    {formatDateTime(questionnaire.deadline)}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>收集状态</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      questionnaire.status === 'completed'
                        ? styles.statusCompleted
                        : styles.statusActive,
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {questionnaire.status === 'completed' ? '已分析' : '收集中'}
                    </Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>意见数量</Text>
                  <Text style={styles.infoValue}>{suggestions.length} 条</Text>
                </View>
                {questionnaire.description ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>描述</Text>
                    <Text style={styles.infoDescription}>
                      {questionnaire.description}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Suggestions Section */}
          <View style={styles.cardOuter}>
            <View style={styles.cardShadow}>
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>收集的意见</Text>
                  {!isDeadlinePassed() && (
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => setShowSubmitModal(true)}
                    >
                      <Text style={styles.addButtonText}>填写意见</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {suggestions.length === 0 ? (
                  <Text style={styles.emptyText}>暂无意见</Text>
                ) : (
                  suggestions.map((item, index) => (
                    <View key={item.id} style={styles.suggestionItem}>
                      <View style={styles.suggestionHeader}>
                        <Text style={styles.suggestionName}>
                          {item.submitter_name}
                        </Text>
                        <Text style={styles.suggestionTime}>
                          {formatDateTime(item.created_at)}
                        </Text>
                      </View>
                      <Text style={styles.suggestionContent}>{item.content}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>

          {/* Analysis Section */}
          {report && (
            <View style={styles.cardOuter}>
              <View style={styles.cardShadow}>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>分析报告</Text>
                  <View style={styles.reportContent}>
                    <Text style={styles.reportText}>
                      {report.analysis_content}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.downloadButton}
                    onPress={handleDownloadReport}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#6C63FF', '#896BFF']}
                      style={styles.downloadButtonGradient}
                    >
                      <Text style={styles.downloadButtonText}>
                        下载Word报告
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Analyze Button */}
          {!isDeadlinePassed() && suggestions.length > 0 && (
            <TouchableOpacity
              style={styles.analyzeButtonContainer}
              onPress={handleAnalyze}
              disabled={analyzing}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={analyzing ? ['#B2BEC3', '#B2BEC3'] : ['#FF6584', '#FF8BA0']}
                style={styles.analyzeButton}
              >
                <Text style={styles.analyzeButtonText}>
                  {analyzing ? '分析中...' : '智能分析意见'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Submit Suggestion Modal */}
        <Modal
          visible={showSubmitModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSubmitModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowSubmitModal(false)}
          >
            <KeyboardAvoidingView
              style={styles.modalContent}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={styles.modalInner}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>填写培训意见</Text>
                  <TouchableOpacity onPress={() => setShowSubmitModal(false)}>
                    <Text style={styles.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView>
                  <View style={styles.modalBody}>
                    <Text style={styles.inputLabel}>您的姓名（选填）</Text>
                    <View style={styles.modalInputContainer}>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="请输入姓名"
                        placeholderTextColor="#B2BEC3"
                        value={submitName}
                        onChangeText={setSubmitName}
                      />
                    </View>
                    <Text style={styles.inputLabel}>培训意见</Text>
                    <View style={styles.modalTextAreaContainer}>
                      <TextInput
                        style={styles.modalTextArea}
                        placeholder="请输入您对培训的意见和建议"
                        placeholderTextColor="#B2BEC3"
                        value={submitContent}
                        onChangeText={setSubmitContent}
                        multiline
                        numberOfLines={6}
                        textAlignVertical="top"
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.modalSubmitButton}
                      onPress={handleSubmitSuggestion}
                      disabled={submitting}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={
                          submitting
                            ? ['#B2BEC3', '#B2BEC3']
                            : ['#6C63FF', '#896BFF']
                        }
                        style={styles.modalSubmitGradient}
                      >
                        <Text style={styles.modalSubmitText}>
                          {submitting ? '提交中...' : '提交意见'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F3',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#636E72',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginHorizontal: 10,
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  cardOuter: {
    marginBottom: 16,
  },
  cardShadow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 6,
  },
  card: {
    backgroundColor: '#F0F0F3',
    borderRadius: 24,
    padding: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6C63FF',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  qrImage: {
    width: 200,
    height: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#E8E8EB',
    borderRadius: 16,
  },
  qrHint: {
    fontSize: 13,
    color: '#636E72',
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#636E72',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
  },
  infoDescription: {
    flex: 1,
    fontSize: 14,
    color: '#2D3436',
    textAlign: 'right',
    marginLeft: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: 'rgba(0, 184, 148, 0.1)',
  },
  statusCompleted: {
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C63FF',
  },
  emptyText: {
    fontSize: 14,
    color: '#B2BEC3',
    textAlign: 'center',
    paddingVertical: 20,
  },
  suggestionItem: {
    backgroundColor: '#E8E8EB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
  },
  suggestionTime: {
    fontSize: 12,
    color: '#B2BEC3',
  },
  suggestionContent: {
    fontSize: 14,
    color: '#636E72',
    lineHeight: 22,
  },
  reportContent: {
    backgroundColor: '#E8E8EB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  reportText: {
    fontSize: 14,
    color: '#2D3436',
    lineHeight: 24,
  },
  downloadButton: {
    marginTop: 8,
  },
  downloadButtonGradient: {
    borderRadius: 9999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  analyzeButtonContainer: {
    marginTop: 16,
  },
  analyzeButton: {
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  analyzeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '80%',
  },
  modalInner: {
    backgroundColor: '#F0F0F3',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
  },
  modalClose: {
    fontSize: 20,
    color: '#636E72',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 8,
  },
  modalInputContainer: {
    backgroundColor: '#E8E8EB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 20,
  },
  modalInput: {
    padding: 16,
    fontSize: 15,
    color: '#2D3436',
  },
  modalTextAreaContainer: {
    backgroundColor: '#E8E8EB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 20,
  },
  modalTextArea: {
    padding: 16,
    fontSize: 15,
    color: '#2D3436',
    minHeight: 120,
  },
  modalSubmitButton: {
    marginTop: 8,
  },
  modalSubmitGradient: {
    borderRadius: 9999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
