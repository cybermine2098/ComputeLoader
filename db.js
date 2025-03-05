const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('fileDB', 'user', 'password', {
  dialect: 'sqlite',
  storage: 'fileDB.sqlite',
  logging:false,
});

const File = sequelize.define('File', {
  filename: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
  },
  purpose: {
    type: DataTypes.STRING,
  },
  tested: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'untested'
  },
  uploaddate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

const runjobs = sequelize.define('runjobs', {
  filename: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'no custom output set'
  },
  starttime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  endtime:{
    type: DataTypes.DATE,
    },
  correspondinguuid: {
    type: DataTypes.STRING,
    allowNull: false
  },
  active:{
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }
});

module.exports = { sequelize, File, runjobs };
