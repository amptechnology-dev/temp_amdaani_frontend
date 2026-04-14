import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { Text, List, Divider, useTheme, Card } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Navbar from '../../components/Navbar';
import api from '../../utils/api';

const HelpSupport = () => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(null);
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const toggleExpand = index => {
    setExpanded(expanded === index ? null : index);
  };

  // ✅ Fetch FAQs from API
  const fetchFaqs = async () => {
    try {
      setLoading(true);

      const response = await api.get('/faq');

      // ✅ handle multiple API formats safely
      const data = response?.data?.data || response?.data || [];

      setFaqs(Array.isArray(data) ? data : []);
      setError(false);
    } catch (err) {
      console.log('FAQ API Error:', err?.response || err.message);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaqs();
  }, []);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Navbar title={'Help & Support'} />

      <View style={styles.content}>
        <Text
          variant="bodyMedium"
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
        >
          Find answers or reach out to us
        </Text>

        {/* FAQ Section */}
        <Card
          style={[
            styles.card,
            { backgroundColor: theme.colors.elevation.level1 },
          ]}
        >
          <Card.Title
            title="FAQs"
            titleStyle={{ color: theme.colors.onSurface }}
          />
          <Card.Content>
            {/* 🔄 Loading */}
            {loading && <ActivityIndicator size="small" />}

            {/* ❌ Error */}
            {error && (
              <Text style={{ color: 'red' }}>
                Failed to load FAQs. Tap to retry.
              </Text>
            )}

            {/* 📭 Empty */}
            {!loading && !error && faqs.length === 0 && (
              <Text>No FAQs available</Text>
            )}

            {/* ✅ Data */}
            {!loading &&
              !error &&
              faqs.map((item, index) => (
                <View key={index}>
                  <List.Accordion
                    title={item.question || item.q || 'No Question'} // ✅ flexible key
                    expanded={expanded === index}
                    onPress={() => toggleExpand(index)}
                    titleStyle={{ color: theme.colors.onSurface }}
                    style={styles.accordion}
                  >
                    <Text style={{ color: theme.colors.onSurfaceVariant }}>
                      {item.answer || item.a || 'No Answer'}
                    </Text>
                  </List.Accordion>
                  {index < faqs.length - 1 && <Divider />}
                </View>
              ))}
          </Card.Content>
        </Card>

        {/* Contact Section */}
        <Card
          style={[
            styles.card,
            { backgroundColor: theme.colors.elevation.level1 },
          ]}
        >
          <Card.Title
            title="Contact Us"
            titleStyle={{ color: theme.colors.onSurface }}
          />
          <Card.Content>
            <List.Item
              title="Email Support"
              description="amptechnologysolution@gmail.com"
              left={props => (
                <List.Icon
                  {...props}
                  icon="email"
                  color={theme.colors.primary}
                />
              )}
              onPress={() =>
                Linking.openURL('mailto:amptechnologysolution@gmail.com')
              }
            />
            <Divider />
            <List.Item
              title="WhatsApp"
              description="+91 8697972001"
              left={props => (
                <List.Icon {...props} icon="whatsapp" color="#25D366" />
              )}
              onPress={() => Linking.openURL('https://wa.me/918697972001')}
            />
            <Divider />
            <List.Item
              title="Call Us"
              description="+91 8697972001"
              left={props => (
                <List.Icon
                  {...props}
                  icon="phone"
                  color={theme.colors.primary}
                />
              )}
              onPress={() => Linking.openURL('tel:+918697972001')} // ✅ FIXED
            />
          </Card.Content>
        </Card>

        {/* Footer */}
        <Text
          variant="bodySmall"
          style={[styles.footer, { color: theme.colors.onSurfaceVariant }]}
        >
          We usually reply within 24 hours
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  subtitle: {
    marginBottom: 16,
    opacity: 0.7,
  },
  card: {
    marginBottom: 20,
    borderRadius: 12,
  },
  accordion: {
    backgroundColor: 'transparent',
  },
  footer: {
    textAlign: 'center',
    marginTop: 12,
    opacity: 0.7,
  },
});

export default HelpSupport;
