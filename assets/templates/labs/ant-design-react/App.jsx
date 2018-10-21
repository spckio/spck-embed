import React from 'react';
import ReactDOM from 'react-dom';

import {
  Layout,
  Menu,
  Breadcrumb,
  Icon,
  Skeleton
} from 'antd';

const { SubMenu } = Menu;
const { Header, Content, Sider } = Layout;

ReactDOM.render(
  <Layout style={{height: '100%'}}>
    <Header className="header">
      <div className="logo" />
      <Menu
        theme="dark"
        mode="horizontal"
        defaultSelectedKeys={['2']}
        style={{ lineHeight: '64px' }}
        >
        <Menu.Item key="1">Home</Menu.Item>
        <Menu.Item key="2">App</Menu.Item>
      </Menu>
    </Header>
    <Layout>
      <Sider width={200} style={{ background: '#fff' }}>
        <Menu
          mode="inline"
          defaultSelectedKeys={['1']}
          defaultOpenKeys={['sub1']}
          style={{ height: '100%', borderRight: 0 }}
          >
          <SubMenu key="sub1" title={<span><Icon type="user" />User</span>}>
            <Menu.Item key="1">Alice</Menu.Item>
            <Menu.Item key="2">Bob</Menu.Item>
            <Menu.Item key="3">Carol</Menu.Item>
          </SubMenu>
          <SubMenu key="sub2" title={<span><Icon type="laptop" />Device</span>}>
            <Menu.Item key="5">Desktop</Menu.Item>
            <Menu.Item key="6">Tablet</Menu.Item>
            <Menu.Item key="7">Phone</Menu.Item>
          </SubMenu>
          <SubMenu key="sub3" title={<span><Icon type="notification" />Notifications</span>}>
            <Menu.Item key="9">Email</Menu.Item>
            <Menu.Item key="10">Text Message</Menu.Item>
          </SubMenu>
        </Menu>
      </Sider>
      <Layout style={{ padding: '0 24px 24px' }}>
        <Breadcrumb style={{ margin: '16px 0' }}>
        <Breadcrumb.Item>Home</Breadcrumb.Item>
        <Breadcrumb.Item>List</Breadcrumb.Item>
        <Breadcrumb.Item>App</Breadcrumb.Item>
        </Breadcrumb>
        <Content style={{ background: '#fff', padding: 24 }}>
          <Skeleton />
        </Content>
      </Layout>
    </Layout>
  </Layout>,
  mountNode);
